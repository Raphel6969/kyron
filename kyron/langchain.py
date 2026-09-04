"""
LangChain integration wrapper for Kyron.
"""
from typing import Any, Callable
from kyron.guard import KyronGuard


class KyronToolWrapper:
    """
    Wraps any LangChain tool or custom callable with Kyron runtime protection.
    """

    def __init__(
        self,
        name: str,
        func: Callable[..., Any],
        guard: KyronGuard,
        description: str = "",
    ):
        self.name = name
        self.func = func
        self.guard = guard
        self.description = description

    def __call__(self, *args: Any, **kwargs: Any) -> Any:
        return self.run(*args, **kwargs)

    def run(
        self,
        incoming_text: str = "",
        incoming_source: str = "user_input",
        **tool_args: Any,
    ) -> Any:
        """Screens the tool arguments through Kyron before running."""
        return self.guard.run_tool(
            tool_name=self.name,
            arguments=tool_args,
            incoming_text=incoming_text or str(tool_args),
            incoming_source=incoming_source,
            tool_fn=self.func,
        )


SentinelToolWrapper = KyronToolWrapper
