/**
 * False Positive Marker Component
 * Allows users to report false positive detections and provide feedback
 */

import { useState } from 'react';
import { Alert, Tag } from 'antd';
import { ToggleField } from '../ToggleField/ToggleField';
import { FormField } from '../FormField/FormField';
import { Textarea } from '../../atoms/Textarea/Textarea';
import { Button } from '../../atoms/Button/Button';
import styles from './FalsePositiveMarker.module.css';

interface FalsePositiveMarkerProps {
  issueId: string;
  onSubmit: (feedback: FeedbackData) => Promise<void>;
  feedbackCount?: number;
}

export interface FeedbackData {
  feedback_type: 'true_positive' | 'false_positive' | 'needs_investigation';
  false_positive_reason?: string;
  notes?: string;
  actual_configuration?: any;
}

export function FalsePositiveMarker({
  issueId: _issueId,
  onSubmit,
  feedbackCount = 0,
}: FalsePositiveMarkerProps) {
  const [isMarking, setIsMarking] = useState(false);
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async () => {
    if (!reason) return;

    setSubmitting(true);
    try {
      await onSubmit({
        feedback_type: 'false_positive',
        false_positive_reason: reason,
        notes: notes.trim() || undefined,
      });

      setSubmitted(true);
      setIsMarking(false);
      setReason('');
      setNotes('');

      // Reset submitted state after 3 seconds
      setTimeout(() => setSubmitted(false), 3000);
    } catch (error) {
      console.error('[FalsePositiveMarker] Failed to submit feedback:', error);
      alert('Failed to submit feedback. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3 className={styles.title}>Issue Feedback</h3>
        {feedbackCount > 0 && (
          <Tag color="blue">
            {feedbackCount} user{feedbackCount !== 1 ? 's' : ''} helped improve this detection
          </Tag>
        )}
      </div>

      {submitted && (
        <Alert
          type="success"
          message="Feedback submitted successfully"
          description="Thank you! Your feedback will help improve detection accuracy."
          showIcon
          closable
          className={styles.successAlert}
        />
      )}

      <Alert
        type="info"
        message="Help improve AI detection accuracy"
        description="Report false positives to help the system learn and improve future detections."
        showIcon
        className={styles.infoAlert}
      />

      <ToggleField
        checked={isMarking}
        onChange={setIsMarking}
        label="Mark as False Positive"
        description="This security alert was incorrect"
      />

      {isMarking && (
        <div className={styles.feedbackForm}>
          <FormField label="Why is this a false positive?" error={!reason ? 'Please select a reason' : undefined}>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className={styles.select}
            >
              <option value="">Select reason...</option>
              <option value="services_disabled">
                ✅ Management services are disabled
              </option>
              <option value="services_restricted">
                ✅ Services restricted to LAN addresses only
              </option>
              <option value="interface_list_protection">
                ✅ Firewall uses interface lists (not explicit interface names)
              </option>
              <option value="upstream_firewall">
                🛡️ Protected by upstream firewall/router
              </option>
              <option value="other_protection_method">
                🔧 Other protection method
              </option>
              <option value="incorrect_interface_type">
                ❌ Interface was misidentified as WAN
              </option>
              <option value="already_fixed">
                ✓ Issue was already fixed
              </option>
            </select>
          </FormField>

          <FormField
            label="Configuration Details (optional)"
            helpText="Help improve detection by sharing your actual setup"
          >
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g., /ip service print shows winbox disabled=yes&#10;or: WAN interface is in 'WAN' interface list with input drop rules"
              rows={4}
            />
          </FormField>

          <div className={styles.actions}>
            <Button
              variant="primary"
              onClick={handleSubmit}
              disabled={!reason || submitting}
            >
              {submitting ? 'Submitting...' : 'Submit Feedback'}
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                setIsMarking(false);
                setReason('');
                setNotes('');
              }}
              disabled={submitting}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      <div className={styles.learningImpact}>
        <p className={styles.impactText}>
          🎓 Your feedback helps the AI learn to avoid similar mistakes in the future
        </p>
      </div>
    </div>
  );
}
