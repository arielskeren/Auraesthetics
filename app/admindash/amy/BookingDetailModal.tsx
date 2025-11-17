'use client';

import { X, XCircle, DollarSign, History, User, Calendar, Mail, Phone } from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';
import { formatInEST } from '@/lib/timezone';

interface Booking {
  id: string;
  cal_booking_id: string | null;
  hapio_booking_id: string | null;
  outlook_event_id: string | null;
  outlook_sync_status: string | null;
  service_name: string;
  client_name: string | null;
  client_email: string | null;
  client_phone: string | null;
  booking_date: string | null;
  amount: number | string | null;
  final_amount: number | string | null;
  deposit_amount: number | string | null;
  discount_code: string | null;
  discount_amount: number | string | null;
  payment_type: 'full' | 'deposit' | null;
  payment_status: string;
  payment_intent_id: string | null;
  created_at: string;
  metadata?: any;
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

  const fetchBookingDetails = useCallback(async () => {
    if (!booking) return;
    
    try {
      setLoading(true);
      // Handle both Neon DB booking objects (with internal id) and Hapio booking objects (with hapio_booking_id)
      const bookingId = (booking as any).hapio_booking_id || (booking as any).id || booking.id;
      const response = await fetch(`/api/admin/bookings/${bookingId}`);
      const data = await response.json();
      
      if (data.success) {
        if (data.booking) {
          setBookingDetails(data.booking as Booking);
        }
        setClientHistory(data.clientHistory || []);
        // If customer_id present, fetch full history via customers endpoint
        if (data.booking?.customer_id) {
          try {
            const h = await fetch(`/api/customers/${data.booking.customer_id}/history`);
            const hj = await h.json();
            if (hj?.success && Array.isArray(hj.history)) {
              // map to ClientHistory shape
              const mapped = hj.history.slice(0, 5).map((item: any) => ({
                id: item.bookingId,
                service_name: item.serviceName,
                booking_date: item.bookingDate,
                payment_type: null,
                payment_status: item.paymentStatus,
                final_amount: (item.amountPaidCents || 0) / 100,
                created_at: item.bookingDate || '',
              }));
              setClientHistory(mapped);
            }
          } catch {}
        }
      }
    } catch (error) {
      console.error('Error fetching booking details:', error);
    } finally {
      setLoading(false);
    }
  }, [booking]);

  useEffect(() => {
    if (isOpen && booking) {
      fetchBookingDetails();
    }
  }, [isOpen, booking, fetchBookingDetails]);

  const handleCancel = async () => {
    if (!booking) return;
    
    const confirmMessage = booking.payment_status === 'paid' && booking.payment_intent_id
      ? 'Are you sure you want to cancel this booking? This will also process a full refund. This action cannot be undone.'
      : 'Are you sure you want to cancel this booking? This action cannot be undone.';
    
    if (!confirm(confirmMessage)) return;
    
    try {
      setActionLoading('cancel');
      setActionMessage(null);
      
      const response = await fetch(`/api/admin/bookings/${booking.id}`, {
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
      
      const response = await fetch(`/api/admin/bookings/${booking.id}`, {
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

  const formatDate = (dateString: string | null) => {
    return formatInEST(dateString);
  };

  const getPaymentTypeLabel = (type: string | null) => {
    switch (type) {
      case 'full':
        return 'Full Payment';
      case 'deposit':
        return '50% Deposit';
      default:
        return 'N/A';
    }
  };

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
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-xl">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-sage-dark/20 px-6 py-4 flex justify-between items-center">
          <h2 className="text-2xl font-serif text-charcoal">Booking Details</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-sand/30 rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-charcoal" />
          </button>
        </div>

        {/* Action Message */}
        {actionMessage && (
          <div className={`mx-6 mt-4 p-4 rounded-lg ${
            actionMessage.type === 'success' 
              ? 'bg-green-50 border border-green-200 text-green-800' 
              : 'bg-red-50 border border-red-200 text-red-800'
          }`}>
            {actionMessage.text}
          </div>
        )}

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Client Information */}
          <div className="bg-sand/20 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-charcoal mb-4 flex items-center gap-2">
              <User className="w-5 h-5" />
              Client Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-warm-gray">Name</label>
                <p className="font-medium text-charcoal">{effective.client_name || 'N/A'}</p>
              </div>
              <div>
                <label className="text-sm text-warm-gray flex items-center gap-1">
                  <Mail className="w-4 h-4" />
                  Email
                </label>
                <p className="font-medium text-charcoal">{effective.client_email || 'N/A'}</p>
              </div>
              <div>
                <label className="text-sm text-warm-gray flex items-center gap-1">
                  <Phone className="w-4 h-4" />
                  Phone
                </label>
                <p className="font-medium text-charcoal">{effective.client_phone || 'N/A'}</p>
              </div>
            </div>
          </div>

          {/* Booking Information */}
          <div className="bg-sand/20 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-charcoal mb-4 flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              Booking Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-warm-gray">Service</label>
                <p className="font-medium text-charcoal">{effective.service_name}</p>
              </div>
              <div>
                <label className="text-sm text-warm-gray">Date/Time</label>
                <p className="font-medium text-charcoal">{formatDate(effective.booking_date)}</p>
              </div>
              <div>
                <label className="text-sm text-warm-gray">Payment Type</label>
                <p className="font-medium text-charcoal">{getPaymentTypeLabel(effective.payment_type)}</p>
              </div>
              <div>
                <label className="text-sm text-warm-gray">Status</label>
                <p className="font-medium text-charcoal">{effective.payment_status}</p>
              </div>
              <div>
                <label className="text-sm text-warm-gray">Amount</label>
                <p className="font-medium text-charcoal">${finalAmount.toFixed(2)}</p>
                {effective.payment_type === 'deposit' && (
                  <p className="text-sm text-warm-gray">
                    Deposit: ${depositAmount.toFixed(2)} • Balance Due: ${balanceDue.toFixed(2)}
                  </p>
                )}
                {effective.discount_code && (
                  <p className="text-sm text-warm-gray">
                    Discount: {effective.discount_code} (-${(Number(effective.discount_amount) || 0).toFixed(2)})
                  </p>
                )}
              </div>
              <div>
                <label className="text-sm text-warm-gray">Hapio Booking ID</label>
                <p className="font-medium text-charcoal font-mono text-sm break-all">
                  {hapioBookingId || 'N/A'}
                </p>
                {hasLegacyCalBooking && (
                  <p className="text-xs text-warm-gray mt-1">
                    Legacy Cal.com ID:{' '}
                    <span className="font-mono">{booking.cal_booking_id}</span>
                  </p>
                )}
              </div>
              <div>
                <label className="text-sm text-warm-gray">Outlook Sync</label>
                <p className="font-medium text-charcoal text-sm">
                {effective.outlook_sync_status ? effective.outlook_sync_status : 'Not synced'}
                </p>
                {effective.outlook_event_id && (
                  <p className="text-xs text-warm-gray mt-1">
                    Event ID:{' '}
                    <span className="font-mono break-all">{effective.outlook_event_id}</span>
                  </p>
                )}
              </div>
              <div>
                <label className="text-sm text-warm-gray">Payment Intent ID</label>
                <p className="font-medium text-charcoal font-mono text-sm break-all">
                  {effective.payment_intent_id || 'N/A'}
                </p>
              </div>
              <div>
                <label className="text-sm text-warm-gray">Created At</label>
                <p className="font-medium text-charcoal">{formatDate(effective.created_at)}</p>
              </div>
              <div className="md:col-span-2">
                <label className="text-sm text-warm-gray">Notes</label>
                <p className="font-medium text-charcoal whitespace-pre-wrap">
                  {effective.metadata?.notes || effective.metadata?.customer_notes || 'None'}
                </p>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="bg-sand/20 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-charcoal mb-4">Actions</h3>
            <div className="flex flex-wrap gap-3">
              {effective.payment_status !== 'cancelled' && (
                <>
                  <button
                    onClick={handleCancel}
                    disabled={actionLoading === 'cancel' || actionLoading === 'refund'}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    <XCircle className="w-4 h-4" />
                    {effective.payment_status === 'paid' && effective.payment_intent_id 
                      ? 'Cancel & Refund' 
                      : 'Cancel Booking'}
                  </button>
                  
              {booking.payment_status === 'paid' && booking.payment_intent_id && (
                    <button
                      onClick={handleRefund}
                      disabled={actionLoading === 'refund' || actionLoading === 'cancel'}
                      className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      <DollarSign className="w-4 h-4" />
                      Refund Only (Keep Booking)
                    </button>
                  )}
                </>
              )}
              
              {effective.payment_status === 'cancelled' && (
                <div className="px-4 py-2 bg-gray-100 text-gray-600 rounded-lg">
                  This booking has been cancelled
                </div>
              )}
              
              {effective.payment_status === 'refunded' && (
                <div className="px-4 py-2 bg-yellow-100 text-yellow-800 rounded-lg">
                  This booking has been refunded (booking remains active)
                </div>
              )}
            </div>
          </div>

          {/* Client History */}
          {effective.client_email && (
            <div className="bg-sand/20 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-charcoal mb-4 flex items-center gap-2">
                <History className="w-5 h-5" />
                Client History (Last 5 Bookings)
              </h3>
              {loading ? (
                <p className="text-warm-gray">Loading...</p>
              ) : clientHistory.length === 0 ? (
                <p className="text-warm-gray">No previous bookings found</p>
              ) : (
                <div className="space-y-2">
                  {clientHistory.map((history) => (
                    <div key={history.id} className="bg-white rounded p-3 border border-sage-dark/20">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-medium text-charcoal">{history.service_name}</p>
                          <p className="text-sm text-warm-gray">{formatDate(history.booking_date)}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-medium text-charcoal">${(Number(history.final_amount) || 0).toFixed(2)}</p>
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
    </div>
  );
}

