'use client';

import { X, Copy, Send, RefreshCw, XCircle, DollarSign, History, User, Calendar, Mail, Phone, MapPin } from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';

interface Booking {
  id: string;
  cal_booking_id: string | null;
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
  const [clientHistory, setClientHistory] = useState<ClientHistory[]>([]);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [bookingUrl, setBookingUrl] = useState<string | null>(null);
  const [showLinkCalBooking, setShowLinkCalBooking] = useState(false);
  const [calBookingIdInput, setCalBookingIdInput] = useState('');

  const fetchBookingDetails = useCallback(async () => {
    if (!booking) return;
    
    try {
      setLoading(true);
      const response = await fetch(`/api/admin/bookings/${booking.id}`);
      const data = await response.json();
      
      if (data.success) {
        setClientHistory(data.clientHistory || []);
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

  const handleRegenerateToken = async () => {
    if (!booking) return;
    
    try {
      setActionLoading('regenerate');
      setActionMessage(null);
      
      const response = await fetch(`/api/admin/bookings/${booking.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'regenerate-token' }),
      });
      
      const data = await response.json();
      
      if (data.success && data.bookingUrl) {
        setBookingUrl(data.bookingUrl);
        setActionMessage({ type: 'success', text: 'Booking link generated! Click "Copy Link" to send to client.' });
      } else {
        setActionMessage({ type: 'error', text: data.error || 'Failed to regenerate token' });
      }
    } catch (error: any) {
      setActionMessage({ type: 'error', text: error.message || 'Failed to regenerate token' });
    } finally {
      setActionLoading(null);
    }
  };

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
    
    if (!confirm('Are you sure you want to refund this booking? This will ONLY process the refund and will NOT cancel the booking. This action cannot be undone.')) return;
    
    try {
      setActionLoading('refund');
      setActionMessage(null);
      
      const response = await fetch(`/api/admin/bookings/${booking.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'refund' }),
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

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setActionMessage({ type: 'success', text: 'Copied to clipboard!' });
    setTimeout(() => setActionMessage(null), 2000);
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
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

  const finalAmount = Number(booking.final_amount) || Number(booking.amount) || 0;
  const depositAmount =
    Number(booking.deposit_amount) || Number(booking.amount) || (booking.payment_type === 'deposit' ? finalAmount / 2 : finalAmount);
  const balanceDue = Math.max(0, finalAmount - depositAmount);
  const hasCalBooking = !!booking.cal_booking_id;
  const canRegenerateToken = !hasCalBooking && booking.payment_status === 'paid' && booking.payment_intent_id;

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
                <p className="font-medium text-charcoal">{booking.client_name || 'N/A'}</p>
              </div>
              <div>
                <label className="text-sm text-warm-gray flex items-center gap-1">
                  <Mail className="w-4 h-4" />
                  Email
                </label>
                <p className="font-medium text-charcoal">{booking.client_email || 'N/A'}</p>
              </div>
              <div>
                <label className="text-sm text-warm-gray flex items-center gap-1">
                  <Phone className="w-4 h-4" />
                  Phone
                </label>
                <p className="font-medium text-charcoal">{booking.client_phone || 'N/A'}</p>
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
                <p className="font-medium text-charcoal">{booking.service_name}</p>
              </div>
              <div>
                <label className="text-sm text-warm-gray">Date/Time</label>
                <p className="font-medium text-charcoal">{formatDate(booking.booking_date)}</p>
              </div>
              <div>
                <label className="text-sm text-warm-gray">Payment Type</label>
                <p className="font-medium text-charcoal">{getPaymentTypeLabel(booking.payment_type)}</p>
              </div>
              <div>
                <label className="text-sm text-warm-gray">Status</label>
                <p className="font-medium text-charcoal">{booking.payment_status}</p>
              </div>
              <div>
                <label className="text-sm text-warm-gray">Amount</label>
                <p className="font-medium text-charcoal">${finalAmount.toFixed(2)}</p>
                {booking.payment_type === 'deposit' && (
                  <p className="text-sm text-warm-gray">
                    Deposit: ${depositAmount.toFixed(2)} • Balance Due: ${balanceDue.toFixed(2)}
                  </p>
                )}
                {booking.discount_code && (
                  <p className="text-sm text-warm-gray">
                    Discount: {booking.discount_code} (-${(Number(booking.discount_amount) || 0).toFixed(2)})
                  </p>
                )}
              </div>
              <div>
                <label className="text-sm text-warm-gray">Cal.com Booking ID</label>
                <p className="font-medium text-charcoal font-mono text-sm">
                  {booking.cal_booking_id || 'N/A'}
                </p>
              </div>
              <div>
                <label className="text-sm text-warm-gray">Payment Intent ID</label>
                <p className="font-medium text-charcoal font-mono text-sm break-all">
                  {booking.payment_intent_id || 'N/A'}
                </p>
              </div>
              <div>
                <label className="text-sm text-warm-gray">Created At</label>
                <p className="font-medium text-charcoal">{formatDate(booking.created_at)}</p>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="bg-sand/20 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-charcoal mb-4">Actions</h3>
            <div className="flex flex-wrap gap-3">
              {canRegenerateToken && (
                <button
                  onClick={handleRegenerateToken}
                  disabled={actionLoading === 'regenerate'}
                  className="px-4 py-2 bg-dark-sage text-white rounded-lg hover:bg-sage-dark disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  <RefreshCw className={`w-4 h-4 ${actionLoading === 'regenerate' ? 'animate-spin' : ''}`} />
                  {bookingUrl ? 'Regenerate Link' : 'Generate Booking Link'}
                </button>
              )}
              
              {bookingUrl && (
                <button
                  onClick={() => copyToClipboard(bookingUrl)}
                  className="px-4 py-2 bg-charcoal text-white rounded-lg hover:bg-charcoal/90 flex items-center gap-2"
                >
                  <Copy className="w-4 h-4" />
                  Copy Link
                </button>
              )}

              {booking.payment_status !== 'cancelled' && (
                <>
                  <button
                    onClick={handleCancel}
                    disabled={actionLoading === 'cancel' || actionLoading === 'refund'}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    <XCircle className="w-4 h-4" />
                    {booking.payment_status === 'paid' && booking.payment_intent_id 
                      ? 'Cancel & Refund' 
                      : 'Cancel Booking'}
                  </button>
                  
                  {booking.payment_status === 'paid' && booking.payment_intent_id && booking.payment_status !== 'refunded' && (
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
              
              {booking.payment_status === 'cancelled' && (
                <div className="px-4 py-2 bg-gray-100 text-gray-600 rounded-lg">
                  This booking has been cancelled
                </div>
              )}
              
              {booking.payment_status === 'refunded' && (
                <div className="px-4 py-2 bg-yellow-100 text-yellow-800 rounded-lg">
                  This booking has been refunded (booking remains active)
                </div>
              )}

              {/* Manual Link Cal.com Booking */}
              {!booking.cal_booking_id && (
                <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm text-blue-800 mb-2">
                    This booking doesn&apos;t have a Cal.com booking ID. If the client has booked on Cal.com, you can link it manually.
                  </p>
                  {!showLinkCalBooking ? (
                    <button
                      onClick={() => setShowLinkCalBooking(true)}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
                    >
                      Link Cal.com Booking
                    </button>
                  ) : (
                    <div className="space-y-2">
                      <input
                        type="text"
                        placeholder="Enter Cal.com Booking ID"
                        value={calBookingIdInput}
                        onChange={(e) => setCalBookingIdInput(e.target.value)}
                        className="w-full px-3 py-2 border border-blue-300 rounded-lg"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={async () => {
                            if (!calBookingIdInput.trim()) {
                              setActionMessage({ type: 'error', text: 'Please enter a Cal.com booking ID' });
                              return;
                            }
                            
                            try {
                              setActionLoading('link');
                              setActionMessage(null);
                              
                              const response = await fetch(`/api/admin/bookings/${booking.id}/link-cal-booking`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ calBookingId: calBookingIdInput.trim() }),
                              });
                              
                              const data = await response.json();
                              
                              if (data.success) {
                                setActionMessage({ type: 'success', text: 'Booking linked successfully!' });
                                setShowLinkCalBooking(false);
                                setCalBookingIdInput('');
                                setTimeout(() => {
                                  onRefresh();
                                  onClose();
                                }, 1500);
                              } else {
                                setActionMessage({ type: 'error', text: data.error || 'Failed to link booking' });
                              }
                            } catch (error: any) {
                              setActionMessage({ type: 'error', text: error.message || 'Failed to link booking' });
                            } finally {
                              setActionLoading(null);
                            }
                          }}
                          disabled={actionLoading === 'link'}
                          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm"
                        >
                          Link
                        </button>
                        <button
                          onClick={() => {
                            setShowLinkCalBooking(false);
                            setCalBookingIdInput('');
                          }}
                          className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 text-sm"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Client History */}
          {booking.client_email && (
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

