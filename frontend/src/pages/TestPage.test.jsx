import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import TestPage from './TestPage';

describe('TestPage unlimited timer', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    act(() => {
      jest.runOnlyPendingTimers();
    });
    jest.useRealTimers();
  });

  it('does not auto-submit when the timer mode is unlimited', async () => {
    const onStartTest = jest.fn().mockResolvedValue({
      sessionId: 'session-1',
      tableName: 'sample_table',
      startRow: 1,
      endRow: 21,
      questionCount: 2,
      questions: [
        {
          questionText: 'Question 1',
          options: ['A', 'B', 'C', 'D'],
          rowNumber: 1,
          rowId: 1,
          sourceTable: 'sample_table',
        },
        {
          questionText: 'Question 2',
          options: ['A', 'B', 'C', 'D'],
          rowNumber: 2,
          rowId: 2,
          sourceTable: 'sample_table',
        },
      ],
      durationMinutes: 0,
    });

    const onSubmitTest = jest.fn().mockResolvedValue({
      obtainedMarks: 0,
      totalMarks: 2,
      percentageScore: 0,
      tableName: 'sample_table',
      startRow: 1,
      endRow: 21,
      questionCount: 2,
      durationMinutes: 0,
      detailedResults: [],
    });

    render(
      <TestPage
        tables={['sample_table']}
        onStartTest={onStartTest}
        onSubmitTest={onSubmitTest}
        onRefreshHistory={jest.fn()}
        onViewHistory={jest.fn()}
      />
    );

    await act(async () => {
      fireEvent.click(screen.getByRole('checkbox', { name: /sample_table/i }));
      fireEvent.change(screen.getByLabelText(/defined timer option/i), { target: { value: 'unlimited' } });
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /^start test$/i }));
    });

    await waitFor(() => expect(screen.getByRole('button', { name: /confirm start/i })).toBeInTheDocument());

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /confirm start/i }));
    });

    await waitFor(() => expect(onStartTest).toHaveBeenCalled());
    await waitFor(() => screen.getByText(/question 1 of 2/i));

    await act(async () => {
      jest.advanceTimersByTime(1000);
    });

    expect(onSubmitTest).not.toHaveBeenCalled();
  });
});
