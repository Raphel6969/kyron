/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { Hero } from './components/Hero';
import { AttackSurface } from './components/AttackSurface';
import { WhatIsSentinel } from './components/WhatIsSentinel';
import { SecurityPillars } from './components/SecurityPillars';
import { DetectionCascade } from './components/DetectionCascade';
import { PolicyEngine } from './components/PolicyEngine';
import { IntegrationBadges } from './components/IntegrationBadges';
import { AttackScenarios } from './components/AttackScenarios';
import { InteractiveArchitecture } from './components/InteractiveArchitecture';
import { AgentIntegration } from './components/AgentIntegration';
import { FinalCTA } from './components/FinalCTA';
import { Footer } from './components/Footer';
import { LoginScreen } from './components/LoginScreen';
import { DashboardView } from './components/DashboardView';
import { UserSession } from './types';
import { setStoredToken, loginAsGuest } from './services/api';

import { ToastProvider } from './components/ToastSystem';

function AppContent() {
  const [currentUser, setCurrentUser] = useState<UserSession | null>(null);
  const [currentView, setCurrentView] = useState<'landing' | 'login' | 'dashboard'>('landing');
  const [demoInitialTab, setDemoInitialTab] = useState<'simulation' | 'audit' | 'policy' | 'tokens' | 'users' | 'library'>('simulation');
  const [reducedMotion, setReducedMotion] = useState(false);
  const [showRoleToast, setShowRoleToast] = useState(false);
  const [guestLoading, setGuestLoading] = useState(false);

  const handleLoginSuccess = (session: UserSession) => {
    setCurrentUser(session);
    setCurrentView('dashboard');
    setShowRoleToast(true);
    setTimeout(() => setShowRoleToast(false), 4500);
  };

  const handleLogoutOrSwitchRole = () => {
    setStoredToken(null);
    setCurrentUser(null);
    setCurrentView('landing');
  };

  /** Guest demo — one click, no account needed */
  const handleGuestLogin = async () => {
    setGuestLoading(true);
    try {
      const data = await loginAsGuest();
      const guestSession: UserSession = {
        id: data.user.id,
        email: data.user.email,
        name: data.user.name,
        role: 'guest' as any,
        roleTitle: 'Demo Evaluator',
        badge: '🎯',
        permissions: data.user.permissions,
        is_guest: true,
      };
      setCurrentUser(guestSession);
      setDemoInitialTab('simulation');
      setCurrentView('dashboard');
      setShowRoleToast(true);
      setTimeout(() => setShowRoleToast(false), 5000);
    } catch (err) {
      // Fallback — go to login if guest endpoint unavailable
      setCurrentView('login');
    } finally {
      setGuestLoading(false);
    }
  };

  const handleOpenDemo = (initialTab: 'simulation' | 'audit' | 'policy' | 'tokens' | 'users' | 'library' = 'simulation') => {
    setDemoInitialTab(initialTab);
    if (!currentUser) {
      setCurrentView('login');
      return;
    }
    setCurrentView('dashboard');
  };

  const handleToggleReducedMotion = () => {
    setReducedMotion((prev) => !prev);
  };

  // 1. FULL-SCREEN DEDICATED DASHBOARD PAGE
  if (currentView === 'dashboard') {
    return (
      <DashboardView
        currentUser={currentUser}
        onBackToLanding={() => setCurrentView('landing')}
        onLogout={handleLogoutOrSwitchRole}
        initialTab={demoInitialTab}
        reducedMotion={reducedMotion}
      />
    );
  }

  // 2. FULL-SCREEN 3D SECURITY PLATFORM LOGIN SCREEN
  if (currentView === 'login') {
    return (
      <div className={`min-h-screen bg-[#020617] text-slate-100 ${reducedMotion ? 'reduced-motion' : ''}`}>
        <LoginScreen 
          onLoginSuccess={handleLoginSuccess}
          onBackToLanding={() => setCurrentView('landing')}
          reducedMotion={reducedMotion}
        />
      </div>
    );
  }

  // 3. LANDING PAGE OVERVIEW
  return (
    <div className={`min-h-screen bg-[#020617] text-slate-100 selection:bg-teal-500/30 selection:text-teal-200 relative overflow-x-hidden ${reducedMotion ? 'reduced-motion' : ''}`}>
      {/* Ambient Frosted Glass Background Orbs */}
      <div className="fixed top-[-120px] right-[-100px] w-[550px] h-[550px] bg-teal-500/10 rounded-full blur-[140px] pointer-events-none z-0" />
      <div className="fixed bottom-[-150px] left-[-100px] w-[650px] h-[650px] bg-indigo-600/15 rounded-full blur-[160px] pointer-events-none z-0" />
      <div className="fixed top-[40%] left-[60%] w-[450px] h-[450px] bg-purple-600/10 rounded-full blur-[150px] pointer-events-none z-0" />

      {/* Role Authenticated Toast Notification */}
      {showRoleToast && currentUser && (
        <div className="fixed top-20 right-4 sm:right-8 z-50 animate-bounce">
          <div className="flex items-center gap-3 px-4 py-2.5 rounded-2xl bg-slate-900/95 border border-teal-500/50 shadow-[0_0_30px_rgba(45,212,191,0.3)] backdrop-blur-xl text-xs font-mono text-slate-200">
            <span className="text-base">{currentUser.badge}</span>
            <div>
              <span className="font-bold text-teal-300">
                {(currentUser as any).is_guest ? '🎯 Guest Session Active' : `Authenticated: ${currentUser.name}`}
              </span>
              <span className="text-slate-400 block text-[10px]">
                {currentUser.roleTitle} • {(currentUser as any).is_guest ? '30 min demo access' : 'Stage 0 Policy Active'}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setShowRoleToast(false)}
              className="text-slate-400 hover:text-white ml-2 text-xs cursor-pointer"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Navigation */}
      <Navbar
        onOpenDemo={handleOpenDemo}
        onOpenLogin={() => setCurrentView('login')}
        reducedMotion={reducedMotion}
        onToggleReducedMotion={handleToggleReducedMotion}
        currentUser={currentUser}
        onSwitchRole={handleLogoutOrSwitchRole}
      />

      {/* Main Landing Flow */}
      <main className="relative z-10">
        {/* 1. Hero with Live Telemetry + Guest CTA */}
        <Hero onOpenDemo={handleOpenDemo} onGuestLogin={handleGuestLogin} guestLoading={guestLoading} reducedMotion={reducedMotion} />

        {/* 2. The 4 Attack Vectors */}
        <AttackSurface />

        {/* 3. The Security Core */}
        <WhatIsSentinel />

        <IntegrationBadges />

        {/* 4. Four Security Pillars */}
        <SecurityPillars />

        {/* 5. Three-Stage Detection Cascade */}
        <DetectionCascade />

        {/* 6. Deterministic Policy Engine */}
        <PolicyEngine />

        {/* 7. Real-World Attack Scenarios */}
        <AttackScenarios />

        {/* 8. 8-Phase Interactive Architecture */}
        <InteractiveArchitecture reducedMotion={reducedMotion} />

        {/* 9. Developer SDK */}
        <div id="developer-sdk">
          <AgentIntegration />
        </div>

        {/* 10. Final CTA */}
        <FinalCTA onOpenDemo={handleOpenDemo} />
      </main>

      {/* Footer */}
      <Footer />
    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <AppContent />
    </ToastProvider>
  );
}
