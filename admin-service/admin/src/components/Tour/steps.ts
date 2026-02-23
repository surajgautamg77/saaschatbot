import { Step } from 'react-joyride';

export const tourSteps: Step[] = [
  {
    target: 'body',
    content: 'Welcome to the guided tour! Let me show you around.',
    placement: 'center',
    disableBeacon: true,
  },
  {
    // Note: The selector '.bots-navigation-link' is a placeholder.
    target: '.joyride-target-bots-link',
    content: 'This is where you can manage and see all of your created bots.',
    disableBeacon: true,
  },
  {
    // Note: The selector '.create-bot-button' is a placeholder.
    target: '.joyride-target-create-bot-button',
    content: 'You can start building a new bot by clicking here.',
    disableBeacon: true,
  },
];
