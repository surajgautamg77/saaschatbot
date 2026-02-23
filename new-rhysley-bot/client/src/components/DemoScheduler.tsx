import React, { useState, useMemo, useEffect } from 'react';
import { CalendarIcon, ChevronLeftIcon, ChevronRightIcon, CloseIcon, LoadingSpinner } from './Icons';
import { type BookingDetails } from '../types';

// This interface defines the props the component needs to function
interface DemoSchedulerProps {
  onConfirmBooking: (details: Omit<BookingDetails, 'id'>) => void;
  onCancel: () => void;
  isSaving?: boolean;
  publicApiKey: string; // The key to identify which company's settings to fetch
  apiBaseUrl: string;   
}

// This defines the shape of the settings we expect from the new public API endpoint
interface CompanyPublicSettings {
    timeZone: string;
    businessHoursStart: number;
    businessHoursEnd: number;
}

const selectClassName = "w-full p-3 bg-gray-800 rounded-lg focus:outline-none focus:ring-1 focus:ring-white/2 disabled:opacity-50";

export const DemoScheduler: React.FC<DemoSchedulerProps> = ({ onConfirmBooking, onCancel, isSaving, publicApiKey, apiBaseUrl }) => {
  // State for managing the company's specific settings (timezone, hours)
  const [settings, setSettings] = useState<CompanyPublicSettings | null>(null);
  
  // State for the calendar UI
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  
  // NEW: State for the time dropdowns
  const [hour, setHour] = useState<string>('');
  const [minute, setMinute] = useState<string>('');
  const [ampm, setAmPm] = useState<string>('AM');
  
  // State for the user's details form
  const [formData, setFormData] = useState({ name: '', email: '', phone: '', details: '' });
  const [validationError, setValidationError] = useState<string | null>(null);

  // Automatically detect the end-user's browser timezone
  const userTimeZone = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone, []);

  // Effect to fetch the specific company's settings when the scheduler opens
  useEffect(() => {
    const fetchSettings = async () => {
        if (!publicApiKey) return;
        try {
            const response = await fetch(`${apiBaseUrl}/api/bots/public/${publicApiKey}`);
            if (!response.ok) throw new Error("Could not load company settings.");
            const data = await response.json();
            setSettings({
                timeZone: data.timeZone || 'UTC',
                businessHoursStart: data.businessHoursStart || 9,
                businessHoursEnd: data.businessHoursEnd || 17,
            });
        } catch (e) {
            setValidationError("Could not load booking settings at this time.");
        }
    };
    fetchSettings();
  }, [publicApiKey, apiBaseUrl]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const { name, email, phone, details } = formData;
    if (!selectedDate || !hour || !minute || !name || !email || !phone) {
      setValidationError('Please select a date and time, and fill out all fields to confirm your booking.');
      return;
    }
    
    // Convert 12-hour format to 24-hour
    let h = parseInt(hour);
    if (ampm === 'PM' && h !== 12) {
      h += 12;
    } else if (ampm === 'AM' && h === 12) { // Midnight case
      h = 0;
    }

    const finalDate = new Date(selectedDate);
    finalDate.setHours(h);
    finalDate.setMinutes(parseInt(minute));
    finalDate.setSeconds(0);
    finalDate.setMilliseconds(0);

    setValidationError(null);
    onConfirmBooking({ name, email, phone, details, date: finalDate, timeZone: userTimeZone });
  };
  
  // Helper functions for calendar UI
  const calendarData = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDayOfMonth = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const days = [];
    for (let i = 0; i < firstDayOfMonth; i++) { days.push({ key: `empty-${i}`, day: null }); }
    for (let i = 1; i <= daysInMonth; i++) { days.push({ key: `day-${i}`, day: i }); }
    return { year, month, days };
  }, [currentDate]);

  const changeMonth = (offset: number) => {
    setCurrentDate(prev => {
        const newDate = new Date(prev);
        newDate.setMonth(prev.getMonth() + offset);
        return newDate;
    });
  };
  
  const handleDateSelected = (date: Date) => {
    setSelectedDate(date);
    // Reset time when a new date is picked
    setHour('');
    setMinute('');
    setAmPm('AM');
  }

  const formatSelectedDateTime = () => {
    if (!selectedDate) return 'Please select a date.';
    let dateString = `Selected: ${selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}`;
    if (hour && minute) {
        dateString += ` at ${hour}:${minute} ${ampm}`;
    }
    return dateString;
  };

  if (validationError && !settings) {
    return <div className="p-4 text-center text-red-400 bg-red-900/50 rounded-lg">{validationError}</div>;
  }
  
  if (!settings) {
    return <div className="p-4 text-center text-gray-400 flex items-center justify-center"><LoadingSpinner className="w-6 h-6 mr-2" />Loading scheduler...</div>;
  }

  return (
    <div className="w-full bg-dark-card rounded-xl shadow-lg my-4 p-6 flex-shrink-0 animate-fade-in">
        <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-gray-100 flex items-center gap-3">
                <CalendarIcon className="w-6 h-6 text-brand-primary" />
                Schedule a Call
            </h2>
            <button onClick={onCancel} className="p-1 rounded-full text-gray-400 hover:bg-gray-700 hover:text-white">
                <CloseIcon className="w-6 h-6" />
            </button>
        </div>
      
        <div className="flex flex-col gap-6">
            {/* Calendar Grid */}
            <div className="flex-1">
                <div className="flex items-center justify-between mb-2">
                    <button onClick={() => changeMonth(-1)}><ChevronLeftIcon /></button>
                    <div className="font-bold text-lg text-gray-200">{currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}</div>
                    <button onClick={() => changeMonth(1)}><ChevronRightIcon /></button>
                </div>
                <div className="grid grid-cols-7 gap-1 text-center text-xs text-gray-400 mb-2">
                    {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, i) => <div key={i}>{day}</div>)}
                </div>
                <div className="grid grid-cols-7 gap-1">
                    {calendarData.days.map(({ key, day }) => {
                        if (day === null) return <div key={key}></div>;
                        const date = new Date(calendarData.year, calendarData.month, day);
                        const isPast = date < new Date(new Date().toDateString());
                        const isSelected = selectedDate?.getTime() === date.getTime();
                        return (
                            <button key={key} disabled={isPast} onClick={() => handleDateSelected(date)}
                                className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${isPast ? 'text-gray-600' : 'hover:bg-brand-primary hover:text-black'} ${isSelected ? 'bg-brand-primary text-black font-bold' : 'text-gray-200'}`}>
                                {day}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Time Input and Form */}
            <div className="flex-1">
                <form onSubmit={handleSubmit} noValidate>
                    <p className="mb-4 text-gray-300 h-5">{formatSelectedDateTime()}</p>

                    <div className="mb-6">
                        <h3 className={`font-semibold text-gray-200 mb-2 ${!selectedDate && 'text-gray-500'}`}>
                            Select a Time ({userTimeZone.replace('_', ' ')})
                        </h3>
                        <div className="flex gap-2">
                            <select value={hour} onChange={e => setHour(e.target.value)} disabled={!selectedDate} className={selectClassName}>
                                <option value="" disabled>Hour</option>
                                {Array.from({ length: 12 }, (_, i) => i + 1).map(h => <option key={h} value={h}>{h}</option>)}
                            </select>
                            <select value={minute} onChange={e => setMinute(e.target.value)} disabled={!selectedDate} className={selectClassName}>
                                <option value="" disabled>Minute</option>
                                {['00', '15', '30', '45'].map(m => <option key={m} value={m}>{m}</option>)}
                            </select>
                            <select value={ampm} onChange={e => setAmPm(e.target.value)} disabled={!selectedDate} className={selectClassName}>
                                <option value="AM">AM</option>
                                <option value="PM">PM</option>
                            </select>
                        </div>
                    </div>
                    
                    <div className="my-6 border-t border-gray-700"></div>
                    
                    <div className="space-y-4">
                        <input type="text" name="name" placeholder="Full Name" value={formData.name} onChange={handleInputChange} required className="w-full p-3 bg-gray-800 rounded-lg focus:outline-none focus:ring-1 focus:ring-white/2" />
                        <input type="email" name="email" placeholder="Email Address" value={formData.email} onChange={handleInputChange} required className="w-full p-3 bg-gray-800 rounded-lg" />
                        <input type="tel" name="phone" placeholder="Phone Number" value={formData.phone} onChange={handleInputChange} required className="w-full p-3 bg-gray-800 rounded-lg" />
                        <textarea name="details" placeholder="What would you like to discuss?" value={formData.details} onChange={handleInputChange} className="w-full p-3 bg-gray-800 rounded-lg h-24 resize-none"></textarea>
                    </div>
                    {validationError && <p className="mt-3 text-sm text-red-400">{validationError}</p>}
                    <button type="submit" disabled={isSaving} className="mt-6 w-full p-3 bg-brand-primary text-black font-bold rounded-lg hover:bg-yellow-300 disabled:opacity-50">
                        {isSaving ? 'Confirming...' : 'Confirm Booking'}
                    </button>
                </form>
            </div>
        </div>
    </div>
  );
};