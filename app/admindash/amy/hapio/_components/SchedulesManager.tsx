'use client';

import { useState } from 'react';
import { Plus, Calendar } from 'lucide-react';
import ScheduleBlockEditModal from './ScheduleBlockEditModal';

export default function SchedulesManager() {
  const [parentType, setParentType] = useState<'project' | 'location' | 'resource'>('resource');
  const [parentId, setParentId] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-charcoal">Schedules</h2>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-dark-sage text-charcoal rounded-lg hover:bg-dark-sage/80 transition-colors text-sm font-medium"
        >
          <Plus className="w-4 h-4" />
          Add Schedule Block
        </button>
      </div>

      <div className="bg-sage-light/30 rounded-lg p-4 border border-sage-light">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-charcoal mb-1">Parent Type</label>
            <select
              value={parentType}
              onChange={(e) => setParentType(e.target.value as 'project' | 'location' | 'resource')}
              className="w-full px-3 py-2 border border-sand rounded-lg text-sm"
            >
              <option value="project">Project</option>
              <option value="location">Location</option>
              <option value="resource">Resource</option>
            </select>
          </div>
          {parentType !== 'project' && (
            <div>
              <label className="block text-sm font-medium text-charcoal mb-1">Parent ID</label>
              <input
                type="text"
                value={parentId}
                onChange={(e) => setParentId(e.target.value)}
                placeholder="Enter parent ID"
                className="w-full px-3 py-2 border border-sand rounded-lg text-sm"
              />
            </div>
          )}
        </div>
      </div>

      <div className="bg-white border border-sand rounded-lg p-6 text-center text-warm-gray">
        <Calendar className="w-12 h-12 mx-auto mb-3 text-warm-gray/50" />
        <p>Schedule management interface coming soon</p>
        <p className="text-sm mt-2">Select a parent type and ID to view schedule blocks</p>
      </div>

      {showAddModal && (
        <ScheduleBlockEditModal
          onClose={() => setShowAddModal(false)}
          onSave={async () => {
            setShowAddModal(false);
            // Could reload schedule data here if needed
          }}
        />
      )}
    </div>
  );
}

