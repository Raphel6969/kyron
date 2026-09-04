"""
Stage 2 ML Classifier Service for Sentinel Layer.

Uses sentence-transformers ('all-MiniLM-L6-v2') to compute dense semantic embeddings
for incoming content and queries the TurboQuant-compressed vector index of known
prompt injection and jailbreak attack patterns (report, Ch.6 & ARCHITECTURE.md).
"""
import json
import logging
from pathlib import Path
from typing import Any, Sequence
import functools
import hashlib
from collections import OrderedDict
import numpy as np

from app.models import MatchedSignal
from app.services.vector_index import TurboQuantVectorIndex

logger = logging.getLogger(__name__)

# Model identifier
MODEL_NAME = "all-MiniLM-L6-v2"
DATA_FILE_PATH = Path(__file__).parent.parent / "data" / "injection_signatures.json"


class MLClassifierService:
    """
    Singleton service wrapper around SentenceTransformer and TurboQuantVectorIndex.
    """

    def __init__(self):
        self._model: Any = None
        self._vector_index: TurboQuantVectorIndex = TurboQuantVectorIndex(num_bits=8)
        self._is_initialized: bool = False
        self._embedding_cache: dict[str, np.ndarray] = OrderedDict()

    def _ensure_initialized(self) -> None:
        if self._is_initialized:
            return

        try:
            from sentence_transformers import SentenceTransformer
            logger.info("Loading sentence-transformer model: %s", MODEL_NAME)
            self._model = SentenceTransformer(MODEL_NAME)
        except Exception as err:
            logger.error("Failed to load SentenceTransformer model %s: %s", MODEL_NAME, err)
            raise RuntimeError(f"Could not load ML embedding model '{MODEL_NAME}': {err}") from err

        # Set initialization flag true to prevent recursion
        self._is_initialized = True

        # Load seed dataset entries into TurboQuantVectorIndex
        self._load_seed_dataset()

    def _load_seed_dataset(self) -> None:
        if not DATA_FILE_PATH.exists():
            logger.warning("Seed dataset file not found at %s", DATA_FILE_PATH)
            return

        with open(DATA_FILE_PATH, "r", encoding="utf-8") as f:
            entries: list[dict[str, Any]] = json.load(f)

        texts = [e["text"] for e in entries]
        embeddings = self._model.encode(texts, convert_to_numpy=True, normalize_embeddings=True)


        for entry, emb in zip(entries, embeddings):
            self._vector_index.add(
                entry_id=entry["id"],
                vector=emb,
                metadata={
                    "category": entry.get("category", "unknown"),
                    "source_dataset": entry.get("source_dataset", "unknown"),
                    "text": entry["text"],
                },
            )

        logger.info(
            "Initialized TurboQuant vector index with %d seed attack embeddings (%d bytes quantized payload)",
            self._vector_index.size(),
            self._vector_index.memory_bytes(),
        )

    def encode(self, texts: str | list[str]) -> np.ndarray:
        """Generates normalized float32 embedding vector(s)."""
        self._ensure_initialized()
        
        # If single string, use cache
        if isinstance(texts, str):
            cache_key = hashlib.md5(texts.encode()).hexdigest()
            if cache_key in self._embedding_cache:
                self._embedding_cache.move_to_end(cache_key)
                return self._embedding_cache[cache_key]
            
            emb = self._model.encode(texts, convert_to_numpy=True, normalize_embeddings=True)
            self._embedding_cache[cache_key] = emb
            if len(self._embedding_cache) > 512:
                self._embedding_cache.popitem(last=False)
            return emb
        
        # Multiple strings, no cache
        embeddings = self._model.encode(texts, convert_to_numpy=True, normalize_embeddings=True)
        return embeddings

    def evaluate(self, text: str) -> tuple[float, list[MatchedSignal]]:
        """
        Evaluates incoming text against the TurboQuant vector index of known injections.

        Returns (ml_score, matched_signals)
        """
        if not text or not text.strip():
            return 0.0, []

        self._ensure_initialized()

        if self._vector_index.size() == 0:
            return 0.0, []

        query_emb = self.encode(text)
        search_results = self._vector_index.search(query_emb, top_k=3)

        if not search_results:
            return 0.0, []

        top_similarity, top_id, top_meta = search_results[0]

        # Similarity threshold: similarity >= 0.48 indicates semantic similarity to known attack vector
        if top_similarity >= 0.48:
            ml_score = max(0.0, min(1.0, round(top_similarity, 2)))
            matched_signal = MatchedSignal(
                stage="ml",
                signal="high_similarity_to_known_injection",
                score=ml_score,
                detail=(
                    f"Semantic similarity {top_similarity:.2f} to known '{top_meta.get('category')}' attack "
                    f"(id: {top_id}, source: {top_meta.get('source_dataset')})"
                ),
            )
            return ml_score, [matched_signal]


        return 0.0, []


# Global singleton instance
_ml_classifier_instance: MLClassifierService | None = None


def get_ml_classifier() -> MLClassifierService:
    global _ml_classifier_instance
    if _ml_classifier_instance is None:
        _ml_classifier_instance = MLClassifierService()
    return _ml_classifier_instance


def evaluate_ml(text: str) -> tuple[float, list[MatchedSignal]]:
    """Convenience function for evaluating text using the ML classifier singleton."""
    service = get_ml_classifier()
    return service.evaluate(text)
