import { afterEach, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { PatientSearch } from './patient-search';
afterEach(() => vi.useRealTimers());
it('keeps the debounce deadline through unrelated parent renders and invokes the latest callback', () => {
  vi.useFakeTimers();
  const before = vi.fn(),
    after = vi.fn();
  const { rerender } = render(<PatientSearch search="" onSearch={before} />);
  fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Avery' } });
  act(() => vi.advanceTimersByTime(200));
  rerender(<PatientSearch search="" onSearch={after} />);
  act(() => vi.advanceTimersByTime(100));
  expect(before).not.toHaveBeenCalled();
  expect(after).toHaveBeenCalledExactlyOnceWith('Avery');
});
it('debounces rapid changes to the final value and clears immediately without a delayed stale commit', () => {
  vi.useFakeTimers();
  const onSearch = vi.fn();
  render(<PatientSearch search="" onSearch={onSearch} />);
  const input = screen.getByRole('textbox');
  for (const value of ['A', 'Av', 'Ave', 'Avery']) {
    fireEvent.change(input, { target: { value } });
    act(() => vi.advanceTimersByTime(100));
  }
  expect(onSearch).not.toHaveBeenCalled();
  act(() => vi.advanceTimersByTime(200));
  expect(onSearch).toHaveBeenCalledTimes(1);
  expect(onSearch).toHaveBeenLastCalledWith('Avery');
  fireEvent.change(input, { target: { value: 'Jordan' } });
  fireEvent.click(screen.getByRole('button', { name: 'Clear search' }));
  expect(onSearch).toHaveBeenLastCalledWith('');
  act(() => vi.advanceTimersByTime(1000));
  expect(onSearch).toHaveBeenCalledTimes(2);
});
it('retains the focused input and newer text across its own commits, while restoring external URL searches', () => {
  vi.useFakeTimers();
  const onSearch = vi.fn(),
    { rerender } = render(<PatientSearch search="" onSearch={onSearch} />);
  const input = screen.getByRole('textbox', { name: 'Search patients' });
  input.focus();
  fireEvent.change(input, { target: { value: 'Ave' } });
  act(() => vi.advanceTimersByTime(300));
  expect(onSearch).toHaveBeenLastCalledWith('Ave');
  fireEvent.change(input, { target: { value: 'Avery' } });
  rerender(<PatientSearch search="Ave" onSearch={onSearch} />);
  expect(screen.getByRole('textbox')).toBe(input);
  expect(input).toHaveFocus();
  expect(input).toHaveValue('Avery');
  act(() => vi.advanceTimersByTime(300));
  expect(onSearch).toHaveBeenLastCalledWith('Avery');
  rerender(<PatientSearch search="Avery" onSearch={onSearch} />);
  expect(input).toHaveValue('Avery');
  rerender(<PatientSearch search="Jordan" onSearch={onSearch} />);
  expect(input).toHaveValue('Jordan');
  fireEvent.click(screen.getByRole('button', { name: 'Clear search' }));
  expect(onSearch).toHaveBeenLastCalledWith('');
});
