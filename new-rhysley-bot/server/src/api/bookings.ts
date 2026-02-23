import * as express from 'express';
import { getBookings, createBooking } from '../controllers/bookings.js';
import { protect } from '../middleware/auth.js'; // [*** MODIFIED ***]

const router = express.Router();

// [*** MODIFIED ***] Use the new 'protect' middleware.
router.get('/bookings', protect, getBookings); 
// createBooking is public but relies on a sessionId which is company-scoped.
router.post('/bookings', createBooking);

export { router as bookingsRouter };