'use client';

import BookingDetailModalImpl from '../../BookingDetailModal';

interface BookingDetailModalProps {
  booking: any;
  onClose: () => void;
  onRefresh?: () => void;
}

export default function BookingDetailModal({ booking, onClose, onRefresh }: BookingDetailModalProps) {
  return (
    <BookingDetailModalImpl
      booking={booking}
      isOpen={true}
      onClose={onClose}
      onRefresh={onRefresh || (() => {})}
    />
  );
}

