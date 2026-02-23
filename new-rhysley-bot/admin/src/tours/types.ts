import { Step } from 'react-joyride';

/**
 * Extends the base react-joyride Step to include custom properties
 * for managing tour flow within the Rhysley app.
 */
export type AppStep = Step & {
    /**
     * If true, this step will not be advanced by the "Next" button click.
     * Instead, it will wait for a route change that matches the `expectedPath`.
     * @default false
     */
    advancesOnRouteChange?: boolean;

    /**
     * The path (or a substring of the path) that the app should be on for
     * this step to be considered "complete" and advance to the next one.
     * This is only used when `advancesOnRouteChange` is true.
     */
    expectedPath?: string;
};
