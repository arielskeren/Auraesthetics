'use client';

import { X, XCircle, DollarSign, History, User, Calendar, Mail, Phone } from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';
import { formatInEST } from '@/lib/timezone';

interface Booking {
  id: string;
  cal_booking_id?: string | null;
  hapio_booking_id?: string | null;
  outlook_event_id?: string | null;
  outlook_sync_status?: string | null;
  service_name?: string;
  service_display_name?: string | null;
  service_image_url?: string | null;
  service_duration?: string | null;
  client_name?: string | null;
  client_email?: string | null;
  client_phone?: string | null;
  booking_date?: string | null;
  amount?: number | string | null;
  final_amount?: number | string | null;
  deposit_amount?: number | string | null;
  discount_code?: string | null;
  discount_amount?: number | string | null;
  payment_type?: 'full' | 'deposit' | null;
  payment_status?: string;
  payment_intent_id?: string | null;
  created_at?: string;
  metadata?: any;
  // Hapio booking object fields (for compatibility)
  startsAt?: string;
  endsAt?: string;
  serviceId?: string;
  service?: { id: string; name: string };
  customer?: { name?: string; email?: string; phone?: string };
}

interface ClientHistory {
  id: string;
  service_name: string;
  booking_date: string | null;
  payment_type: string | null;
  payment_status: string;
  final_amount: number | string | null;
  created_at: string;
}

interface BookingDetailModalProps {
  booking: Booking | null;
  isOpen: boolean;
  onClose: () => void;
  onRefresh: () => void;
}

export default function BookingDetailModal({ booking, isOpen, onClose, onRefresh }: BookingDetailModalProps) {
  const [loading, setLoading] = useState(false);
  const [bookingDetails, setBookingDetails] = useState<Booking | null>(booking);
  const [clientHistory, setClientHistory] = useState<ClientHistory[]>([]);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Extract booking ID helper
  const getBookingId = useCallback((b: Booking | null) => 
    b ? ((b as any).hapio_booking_id || (b as any).id || b.id) : null, []);

  const fetchBookingDetails = useCallback(async () => {
    if (!booking) return;
    
    const currentBookingId = getBookingId(booking);
    try {
      setLoading(true);
      setActionMessage(null);
      
      const response = await fetch(`/api/admin/bookings/${currentBookingId}`);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        if (response.status === 404) {
          setActionMessage({ type: 'error', text: 'Booking not found. This booking may have been deleted.' });
          setTimeout(onClose, 2000);
          return;
        }
        setActionMessage({ type: 'error', text: `Failed to load booking: ${errorData.error || 'Unknown error'}` });
        return;
      }
      
      const data = await response.json();
      
      // Race condition check
      if (getBookingId(booking) !== currentBookingId) return;
      
      if (data.success && data.booking) {
        setBookingDetails(data.booking as Booking);
        setClientHistory(data.clientHistory || []);
      } else {
        setActionMessage({ type: 'error', text: data.error || 'Failed to load booking details' });
      }
    } catch (error) {
      setActionMessage({ type: 'error', text: error instanceof Error ? error.message : 'Failed to load booking details' });
    } finally {
      setLoading(false);
    }
  }, [booking, onClose, getBookingId]);

  useEffect(() => {
    if (isOpen && booking) {
      fetchBookingDetails();
    }
  }, [isOpen, booking, fetchBookingDetails]);

  const handleCancel = async () => {
    if (!booking) return;
    const effective = bookingDetails || booking;
    const bookingId = getBookingId(effective);
    if (!bookingId) return;
    
    const isPaid = (effective.payment_status === 'paid' || effective.payment_status === 'succeeded') && effective.payment_intent_id;
    const confirmMessage = isPaid
      ? 'Are you sure you want to cancel this booking? This will also process a full refund. This action cannot be undone.'
      : 'Are you sure you want to cancel this booking? This action cannot be undone.';
    
    if (!confirm(confirmMessage)) return;
    
    try {
      setActionLoading('cancel');
      setActionMessage(null);
      
      const response = await fetch(`/api/admin/bookings/${bookingId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'cancel' }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        setActionMessage({ 
          type: 'success', 
          text: data.refunded 
            ? 'Booking cancelled and refund processed successfully' 
            : 'Booking cancelled successfully' 
        });
        setTimeout(() => {
          onRefresh();
          onClose();
        }, 1500);
      } else {
        setActionMessage({ type: 'error', text: data.error || 'Failed to cancel booking' });
      }
    } catch (error: any) {
      setActionMessage({ type: 'error', text: error.message || 'Failed to cancel booking' });
    } finally {
      setActionLoading(null);
    }
  };

  const handleRefund = async () => {
    if (!booking) return;
    const effective = bookingDetails || booking;
    const bookingId = getBookingId(effective);
    if (!bookingId) return;
    
    const choice = prompt(
      'Refund amount:\n- Enter one of: 15,25,50,75,100 (percent)\n- Or enter a custom amount in dollars (e.g., 42.50)\n- Leave empty to refund full amount'
    );
    let percentage: number | null = null;
    let amountCents: number | null = null;
    if (choice && choice.trim().length > 0) {
      const trimmed = choice.trim();
      const pct = Number(trimmed);
      if (!Number.isNaN(pct) && [15, 25, 50, 75, 100].includes(pct)) {
        percentage = pct;
      } else {
        const amt = Number(trimmed);
        if (!Number.isNaN(amt) && amt >= 0) {
          amountCents = Math.round(amt * 100);
        }
      }
    }
    
    try {
      setActionLoading('refund');
      setActionMessage(null);
      
      const response = await fetch(`/api/admin/bookings/${bookingId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'refund', percentage, amountCents }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        setActionMessage({ 
          type: 'success', 
          text: `Refund processed successfully. Refund ID: ${data.refundId || 'N/A'}` 
        });
        setTimeout(() => {
          onRefresh();
          onClose();
        }, 2000);
      } else {
        setActionMessage({ type: 'error', text: data.error || 'Failed to process refund' });
      }
    } catch (error: any) {
      setActionMessage({ type: 'error', text: error.message || 'Failed to process refund' });
    } finally {
      setActionLoading(null);
    }
  };

  const formatDate = (dateString: string | null | undefined) => {
    return formatInEST(dateString || null);
  };

  // Format date as MM/DD in EST
  const formatDateShort = (dateString: string | null | undefined): string => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/New_York',
        month: '2-digit',
        day: '2-digit',
      });
      return formatter.format(date);
    } catch {
      return 'N/A';
    }
  };

  // Format time in EST
  const formatTimeEST = (dateString: string | null | undefined): string => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      return new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/New_York',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      }).format(date);
    } catch {
      return 'N/A';
    }
  };

  const getPaymentTypeLabel = (type: string | null | undefined) => {
    switch (type) {
      case 'full':
        return 'Full Payment';
      case 'deposit':
        return '50% Deposit';
      default:
        return 'N/A';
    }
  };

  // Payment Type Explanation: 
  // 'full' = customer paid the full service amount upfront
  // 'deposit' = customer paid only a partial amount (typically 50%) as a deposit
  // This is different from payment_status which indicates the payment state (succeeded, cancelled, etc.)

  if (!isOpen || !booking) return null;

  const effective = bookingDetails || booking;

  const finalAmount = Number(effective.final_amount) || Number(effective.amount) || 0;
  const depositAmount =
    Number(effective.deposit_amount) || Number(effective.amount) || (effective.payment_type === 'deposit' ? finalAmount / 2 : finalAmount);
  const balanceDue = Math.max(0, finalAmount - depositAmount);
  const hapioBookingId = effective.hapio_booking_id;
  const hasLegacyCalBooking = !!effective.cal_booking_id;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-charcoal/60 backdrop-blur-sm">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[95vh] overflow-y-auto shadow-xl">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-sage-dark/20 px-4 py-2 flex justify-between items-center">
          <h2 className="text-xl font-serif text-charcoal">Booking Details</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-sand/30 rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-charcoal" />
          </button>
        </div>

        {/* Action Message */}
        {actionMessage && (
          <div className={`mx-4 mt-2 p-2 rounded text-sm ${
            actionMessage.type === 'success' 
              ? 'bg-green-50 border border-green-200 text-green-800' 
              : 'bg-red-50 border border-red-200 text-red-800'
          }`}>
            {actionMessage.text}
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="p-4 text-center">
            <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-dark-sage"></div>
            <p className="mt-2 text-sm text-warm-gray">Loading booking details...</p>
          </div>
        )}

        {/* Content */}
        {!loading && (
          <div className="p-4 space-y-3">
            {/* Top Section: Client Info + Quick Actions (left) + Service Details (right) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* Left Column: Client Info + Quick Actions */}
              <div className="space-y-3">
                {/* Client Information - Shortened */}
                <div className="bg-sand/20 rounded-lg p-2.5">
                  <h3 className="text-sm font-semibold text-charcoal mb-1.5 flex items-center gap-2">
                    <User className="w-3.5 h-3.5" />
                    Client Information
                  </h3>
                  <div className="space-y-1.5">
                    <div>
                      <label className="text-xs text-warm-gray mb-0.5">Name</label>
                      <p className="font-medium text-charcoal text-sm px-2 py-1 border border-sage-dark/20 rounded bg-white">{effective.client_name || 'N/A'}</p>
                    </div>
                    <div>
                      <label className="text-xs text-warm-gray mb-0.5 flex items-center gap-1">
                        <Mail className="w-3 h-3" />
                        Email
                      </label>
                      <p className="font-medium text-charcoal text-sm px-2 py-1 border border-sage-dark/20 rounded bg-white break-all">{effective.client_email || 'N/A'}</p>
                    </div>
                    <div>
                      <label className="text-xs text-warm-gray mb-0.5 flex items-center gap-1">
                        <Phone className="w-3 h-3" />
                        Phone
                      </label>
                      <p className="font-medium text-charcoal text-sm px-2 py-1 border border-sage-dark/20 rounded bg-white">{effective.client_phone || 'N/A'}</p>
                    </div>
                  </div>
                </div>

                {/* Quick Actions - Below Client Info, Same Width */}
                <div className="bg-sand/20 rounded-lg p-2.5">
                  <h3 className="text-sm font-semibold text-charcoal mb-1.5">Quick Actions</h3>
                  <div className="flex flex-wrap gap-2">
                    {effective.payment_status !== 'cancelled' && (
                      <>
                        <button
                          onClick={handleCancel}
                          disabled={actionLoading === 'cancel' || actionLoading === 'refund'}
                          className="px-3 py-1.5 text-sm bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          {((effective.payment_status === 'paid' || effective.payment_status === 'succeeded') && effective.payment_intent_id)
                            ? 'Cancel & Refund' 
                            : 'Cancel Booking'}
                        </button>
                        
                        {((effective.payment_status === 'paid' || effective.payment_status === 'succeeded') && effective.payment_intent_id) && (
                          <button
                            onClick={handleRefund}
                            disabled={actionLoading === 'refund' || actionLoading === 'cancel'}
                            className="px-3 py-1.5 text-sm bg-orange-600 text-white rounded hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
                          >
                            <DollarSign className="w-3.5 h-3.5" />
                            Refund Only
                          </button>
                        )}
                      </>
                    )}
                    
                    {effective.payment_status === 'cancelled' && (
                      <div className="px-3 py-1.5 text-sm bg-gray-100 text-gray-600 rounded">
                        This booking has been cancelled
                      </div>
                    )}
                    
                    {effective.payment_status === 'refunded' && (
                      <div className="px-3 py-1.5 text-sm bg-yellow-100 text-yellow-800 rounded">
                        This booking has been refunded (booking remains active)
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Service Details - Right Side, Half Width */}
              <div className="bg-sand/20 rounded-lg p-3">
                <h3 className="text-base font-semibold text-charcoal mb-3 flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  Service Details
                </h3>
                
                {/* Service Photo and Name */}
                <div className="flex items-start gap-3 mb-3">
                  {effective.service_image_url ? (
                    <img 
                      src={effective.service_image_url} 
                      alt={effective.service_display_name || effective.service_name || 'Service'}
                      className="w-16 h-16 object-cover rounded-lg border border-sage-dark/20 flex-shrink-0"
                    />
                  ) : (
                    <div className="w-16 h-16 bg-gradient-to-br from-dark-sage/20 to-sand/40 rounded-lg border border-sage-dark/20 flex-shrink-0 flex items-center justify-center">
                      <Calendar className="w-6 h-6 text-dark-sage/50" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-charcoal text-sm leading-tight mb-1">
                      {effective.service_display_name || effective.service_name || 'N/A'}
                    </p>
                    {effective.service_duration && (
                      <p className="text-xs text-warm-gray">{effective.service_duration}</p>
                    )}
                  </div>
                </div>

                {/* Date and Time (side by side) */}
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <div>
                    <label className="text-xs text-warm-gray mb-1">Date</label>
                    <p className="font-medium text-charcoal text-sm px-2 py-1.5 border border-sage-dark/20 rounded bg-white">{formatDateShort(effective.booking_date)}</p>
                  </div>
                  <div>
                    <label className="text-xs text-warm-gray mb-1">Time (EST)</label>
                    <p className="font-medium text-charcoal text-sm px-2 py-1.5 border border-sage-dark/20 rounded bg-white">{formatTimeEST(effective.booking_date)}</p>
                  </div>
                </div>

                {/* Amount Paid */}
                <div>
                  <label className="text-xs text-warm-gray mb-1">Amount Paid</label>
                  <p className="font-medium text-charcoal text-sm px-2 py-1.5 border border-sage-dark/20 rounded bg-white">${finalAmount.toFixed(2)}</p>
                </div>

                {/* Payment Type - only show if it's a deposit (partial payment) */}
                {effective.payment_type === 'deposit' && (
                  <div className="mt-2">
                    <label className="text-xs text-warm-gray mb-1">
                      Payment Type
                      <span className="ml-1 text-xs text-warm-gray/70" title="This booking was paid as a partial deposit (typically 50%). The remaining balance may be due at the appointment.">
                        (?)
                      </span>
                    </label>
                    <p className="font-medium text-charcoal text-sm px-2 py-1.5 border border-sage-dark/20 rounded bg-white">{getPaymentTypeLabel(effective.payment_type)}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Bottom Section: Other Info (left) + Client History (right) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* Other Information - Left Side */}
              <div className="bg-sand/20 rounded-lg p-3">
                <h3 className="text-base font-semibold text-charcoal mb-2">Other Information</h3>
                <div className="space-y-2">
                  <div>
                    <label className="text-xs text-warm-gray mb-1">Status</label>
                    <p className="font-medium text-charcoal text-sm px-2 py-1.5 border border-sage-dark/20 rounded bg-white">{effective.payment_status || 'N/A'}</p>
                  </div>
                  {effective.payment_type === 'deposit' && (
                    <div>
                      <label className="text-xs text-warm-gray mb-1">Deposit Details</label>
                      <p className="text-xs text-charcoal px-2 py-1.5 border border-sage-dark/20 rounded bg-white">
                        Deposit: ${depositAmount.toFixed(2)} • Balance Due: ${balanceDue.toFixed(2)}
                      </p>
                    </div>
                  )}
                  {effective.discount_code && (
                    <div>
                      <label className="text-xs text-warm-gray mb-1">Discount</label>
                      <p className="text-xs text-charcoal px-2 py-1.5 border border-sage-dark/20 rounded bg-white">
                        {effective.discount_code} (-${(Number(effective.discount_amount) || 0).toFixed(2)})
                      </p>
                    </div>
                  )}
                  <div>
                    <label className="text-xs text-warm-gray mb-1">Hapio Booking ID</label>
                    <p className="font-medium text-charcoal font-mono text-xs px-2 py-1.5 border border-sage-dark/20 rounded bg-white break-all">
                      {hapioBookingId || 'N/A'}
                    </p>
                  </div>
                  <div>
                    <label className="text-xs text-warm-gray mb-1">Payment Intent ID</label>
                    <p className="font-medium text-charcoal font-mono text-xs px-2 py-1.5 border border-sage-dark/20 rounded bg-white break-all">
                      {effective.payment_intent_id || 'N/A'}
                    </p>
                  </div>
                  <div>
                    <label className="text-xs text-warm-gray mb-1">Outlook Sync</label>
                    <p className="font-medium text-charcoal text-xs px-2 py-1.5 border border-sage-dark/20 rounded bg-white">
                      {effective.outlook_sync_status || 'Not synced'}
                    </p>
                    {effective.outlook_event_id && (
                      <p className="text-xs text-warm-gray mt-1 font-mono break-all">
                        {effective.outlook_event_id}
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="text-xs text-warm-gray mb-1">Created At</label>
                    <p className="font-medium text-charcoal text-sm px-2 py-1.5 border border-sage-dark/20 rounded bg-white">{formatDate(effective.created_at)}</p>
                  </div>
                  <div>
                    <label className="text-xs text-warm-gray mb-1">Notes</label>
                    <p className="font-medium text-charcoal text-sm px-2 py-1.5 border border-sage-dark/20 rounded bg-white whitespace-pre-wrap min-h-[2rem]">
                      {effective.metadata?.notes || effective.metadata?.customer_notes || 'None'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Client History - Right Side */}
              {effective.client_email && (
                <div className="bg-sand/20 rounded-lg p-3">
                  <h3 className="text-base font-semibold text-charcoal mb-2 flex items-center gap-2">
                    <History className="w-4 h-4" />
                    Client History (Last 5)
                  </h3>
                  {loading ? (
                    <p className="text-xs text-warm-gray">Loading...</p>
                  ) : clientHistory.length === 0 ? (
                    <p className="text-xs text-warm-gray">No previous bookings found</p>
                  ) : (
                    <div className="space-y-1.5">
                      {clientHistory.map((history) => (
                        <div key={history.id} className="bg-white rounded p-2 border border-sage-dark/20">
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="font-medium text-charcoal text-sm">{history.service_name}</p>
                              <p className="text-xs text-warm-gray">{formatDate(history.booking_date)}</p>
                            </div>
                            <div className="text-right">
                              <p className="font-medium text-charcoal text-sm">${(Number(history.final_amount) || 0).toFixed(2)}</p>
                              <p className="text-xs text-warm-gray">{history.payment_status}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

