import { AppStep } from './types';
import { PATHS } from '../routes/paths';

export const onboardingSteps: AppStep[] = [
  {
    target: 'body',
    content: "Welcome to RhysleyBot! Let's get your first AI agent live in just 2 minutes.",
    placement: 'center',
    disableBeacon: true,
  },
  {
    target: '[data-tour="nav-bots"]',
    content: "First, navigate to the Bots section to manage your assistants.",
    placement: 'right',
    spotlightClicks: true,
    disableBeacon: true,
    advancesOnRouteChange: false,
    data: {
      previous: '/',
      next: PATHS.BOTS,
    },
  },
  {
    target: '[data-tour="create-bot-btn"]',
    content: "Click here to create a new bot. (Don't worry, the tour will wait for you!)",
    placement: 'bottom',
    spotlightClicks: true,
    advancesOnRouteChange: false,
    disableBeacon: true,
    data: {
      autoClick: true,
      previous: '/',
    },
  },
  {
    target: '[data-tour="bot-name-input"]',
    content: "First, give your new bot a name. Something memorable!",
    placement: 'bottom',
    disableBeacon: true,
  },
  {
    target: '[data-tour="create-bot-submit"]',
    content: "Great! Now click 'Create' to bring your bot to life.",
    placement: 'bottom',
    spotlightClicks: true,
    advancesOnRouteChange: true,
    disableBeacon: true,
    data: {
      next: PATHS.BOT_BUILDER,
      autoClick: true,
    },
  },
  {
    target: '[data-tour="toolbox-panel"]',
    content: "Your bot is created with a default flow that works out of the box! you can configure your bot response from here",
    placement: 'bottom',
    spotlightClicks: true,
    advancesOnRouteChange: false,
    disableBeacon: true,
    data: {
      previous: PATHS.BOTS,
      next: PATHS.BOT_BRANDING,
      previousStepIndex: 2,
    },
  },
  {
    target: '[data-tour="branding-form"]',
    content: "Fill in your bot's name and welcome message here, then click 'Save Settings'. Once you have saved, click 'Next' on this tour bubble.",
    placement: 'right',
    spotlightClicks: true,
    advancesOnRouteChange: false,
    disableBeacon: true,
    data: {
      previous: PATHS.BOT_BUILDER,
      next: PATHS.BOT_KNOWLEDGE,
    },
  },
  {
    target: '[data-tour="knowledge-uploader"]',
    content: "Click inside the dotted area to select a document (PDF, Word, Excel) from your computer. Download the sample file to understand the general format.",
    placement: 'top',
    disableBeacon: true,
    data: {
      previous: PATHS.BOT_BRANDING,
    },
  },
  {
    target: '[data-tour="upload-button"]',
    content: "Important: You must click this button to actually upload and process the file. Wait for the 'Success' message, then click Next to go to the installation page.",
    placement: 'bottom',
    spotlightClicks: true,
    advancesOnRouteChange: false,
    disableBeacon: true,
    data: {
      previous: PATHS.BOT_KNOWLEDGE,
      next: PATHS.INSTALLATION,
    },
  },
  {
    target: 'body',
    placement: 'center',
    content: "Great! You're on the installation page. The next step will highlight the code you need to copy.",
    disableBeacon: true,
    data: {
      previous: PATHS.BOT_KNOWLEDGE,
    },
  },
  {
    target: '[data-tour="embed-code-area"]',
    content: "Copy this code snippet and paste it into your website's HTML. Your bot is now live!",
    placement: 'top',
    spotlightClicks: true,
    disableBeacon: true,
    data: {
      previous: PATHS.INSTALLATION,
    },
  },
  {
    target: '[data-tour="nav-inbox"]',
    content: "Finally, head to the Inbox to monitor live chats as they come in. Must have chatbot open in your website to see live chats.",
    placement: 'right',
    spotlightClicks: true,
    advancesOnRouteChange: false,
    disableBeacon: true,
    data: {
      previous: PATHS.INSTALLATION,
      next: PATHS.INBOX,
    },
  }
];