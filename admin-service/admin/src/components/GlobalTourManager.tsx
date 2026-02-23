

import React, { useEffect } from 'react';
import Joyride, { CallBackProps, STATUS, EVENTS } from 'react-joyride';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTourStore } from '../store/useTourStore';
import { onboardingSteps } from '../tours';
import { PATHS } from '../routes/paths';

export const GlobalTourManager: React.FC = () => {
  const { activeTour, run, stepIndex, stopTour, nextStep, prevStep, startTour, resumeTour, setStepIndex } = useTourStore();
  const steps = onboardingSteps;
  const location = useLocation();
  const navigate = useNavigate();

  // --- AUTO-START LOGIC ---
  // Automatically start onboarding for users on the dashboard who haven't finished it.
  useEffect(() => {
    const hasCompletedTour = localStorage.getItem('rhysley_tour_completed');

    // Case 1: Start fresh if not completed and not active
    if (!hasCompletedTour && !activeTour && location.pathname === PATHS.DASHBOARD) {
      startTour('onboarding');
    }

    // Case 2: Resume if active (persisted) but paused (run=false)
    if (!hasCompletedTour && activeTour === 'onboarding' && !run) {
      resumeTour();
    }
  }, [activeTour, run, location.pathname, startTour, resumeTour]);

  // --- ROUTE WATCHER LOGIC ---
  // This effect advances the tour automatically when the user navigates to
  // the URL that a route-dependent step was waiting for.
  useEffect(() => {
    const currentStep = steps[stepIndex];

    if (!run || !currentStep?.advancesOnRouteChange || !currentStep.data?.next) {
      return;
    }

    // Convert route pattern to regex: /bot/:botId/builder -> /bot/[^/]+/builder
    const pattern = currentStep.data.next.replace(/:[^/]+/g, '[^/]+');
    const regex = new RegExp(`^${pattern}$`);

    if (regex.test(location.pathname)) {
      nextStep();
    }
  }, [location.pathname, stepIndex, steps, run, nextStep]);


  // --- JOYRIDE CALLBACK HANDLER ---
  const handleJoyrideCallback = (data: CallBackProps) => {
    const { status, type, index, action } = data;

    if (action === 'close' || ([STATUS.FINISHED, STATUS.SKIPPED] as string[]).includes(status)) {
      // If it was the onboarding tour, mark it as complete so it doesn't auto-pop again.
      if (activeTour === 'onboarding') {
        localStorage.setItem('rhysley_tour_completed', 'true');
      }
      stopTour();
    } else if (type === EVENTS.STEP_AFTER && action === 'next') {
      const currentStep = steps[index];

      if (currentStep?.data?.autoClick && typeof currentStep.target === 'string') {
        const targetElement = document.querySelector(currentStep.target) as HTMLElement;
        if (targetElement) {
          targetElement.click();
        }
      }

      // If the step is NOT waiting for a route change, we might need to navigate.
      if (!currentStep?.advancesOnRouteChange) {
        if (currentStep?.data?.next) {
          let nextPath = currentStep.data.next;
          if (nextPath.includes(':botId')) {
            const currentPathParts = location.pathname.split('/');
            // Assuming currentPath is like /bot/BOT_ID/builder or /bot/BOT_ID/branding
            // And that botId is always the third segment.
            if (currentPathParts.length >= 3) {
              const botId = currentPathParts[2];
              nextPath = nextPath.replace(':botId', botId);
            }
          }
          navigate(nextPath);
        }
        nextStep(); // Advance to the next step
      }
    } else if (type === EVENTS.STEP_AFTER && action === 'prev') {
      const currentStep = steps[index];
      if (!currentStep?.advancesOnRouteChange) {
        if (currentStep?.data?.previous) {
          let prevPath = currentStep.data.previous;
          if (prevPath.includes(':botId')) {
            const currentPathParts = location.pathname.split('/');
            if (currentPathParts.length >= 3) {
              const botId = currentPathParts[2];
              prevPath = prevPath.replace(':botId', botId);
            }
          }
          navigate(prevPath);
        }
        if (currentStep.data?.previousStepIndex !== undefined) {
          setStepIndex(currentStep.data.previousStepIndex);
        } else {
          prevStep();
        }
      }
    } else if (type === EVENTS.TARGET_NOT_FOUND) {
      // This will tell us if the Sidebar link is missing
      console.warn(`[Tour] Target not found for step ${index}. Selector: ${steps[index]?.target}`);
    }
  };

  return (
    <Joyride
      steps={steps}
      run={run}
      stepIndex={stepIndex}
      callback={handleJoyrideCallback}
      continuous
      showProgress
      showSkipButton
      disableOverlayClose={true}
      spotlightClicks={true}

      floaterProps={{
        disableAnimation: true,
      }}

      styles={{
        options: {
          zIndex: 999999,
          arrowColor: '#1e293b',
          backgroundColor: '#1e293b',
          primaryColor: '#ffd400',
          textColor: '#fff',
          overlayColor: 'rgba(0, 0, 0, 0.6)',
        },
        buttonNext: {
          backgroundColor: '#ffd400',
          color: '#000',
          fontWeight: 'bold',
          borderRadius: '4px',
          outline: 'none'
        },
        buttonBack: {
          color: '#9ca3af',
          marginRight: '10px'
        },
        buttonSkip: {
          color: '#ef4444', // Red-ish for skip
        }
      }}
    />
  );
};