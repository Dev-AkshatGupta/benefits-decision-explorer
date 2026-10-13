import { useState } from 'react';
import { Link } from 'react-router';
import { Button } from '@/components/ui/button';
import type { ProgramEvaluationResult } from '../../eligibility/domain/types';
import { fieldLabels } from '../../eligibility/ui/decision-presentation';
import { TaskEditor } from './task-editor';
export function EligibilityFollowUp({
  result,
  outdated,
}: {
  result: ProgramEvaluationResult;
  outdated: boolean;
}) {
  const [open, setOpen] = useState(false),
    [saved, setSaved] = useState('');
  const field = result.missingFields[0];
  return (
    <div className="mt-4 space-y-3">
      <p className="text-xs">
        Missing information:{' '}
        {result.missingFields.map((field) => fieldLabels[field]).join(', ')}.
      </p>
      <Button
        variant="outline"
        disabled={outdated}
        aria-label={'Create Follow-up Task for ' + result.programName}
        onClick={() => setOpen(true)}
      >
        Create Follow-up Task
      </Button>
      {outdated && (
        <p className="text-xs">
          Rerun outdated screening before creating a follow-up.
        </p>
      )}
      {saved && (
        <p role="status" className="text-sm">
          Follow-up saved.{' '}
          <Link
            className="underline"
            to={'/tasks?task=' + encodeURIComponent(saved) + '&status=all'}
          >
            View follow-up task
          </Link>
        </p>
      )}
      {open && (
        <TaskEditor
          draft={{
            patientId: result.patientId,
            type: 'eligibility_follow_up',
            title: 'Review missing information for ' + result.programName,
            description:
              'Review ' +
              result.missingFields
                .map((field) => fieldLabels[field])
                .join(', ') +
              '. This fictional screening follow-up does not guarantee eligibility. Rerun screening after information is corrected.',
            source: {
              patientId: result.patientId,
              programId: result.programId,
              screening: {
                policyVersion: result.policyVersion,
                evaluationDate: result.evaluatedAt,
              },
              ...(field ? { missingField: field } : {}),
            },
          }}
          onClose={() => setOpen(false)}
          onSaved={(task) => {
            setOpen(false);
            setSaved(task.id);
          }}
        />
      )}
    </div>
  );
}
