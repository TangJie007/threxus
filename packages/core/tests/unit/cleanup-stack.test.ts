import { describe, expect, it } from 'vitest';
import { CleanupStack, ThrexusError } from '../../src';

describe('CleanupStack', () => {
  it('disposes cleanups in reverse order', async () => {
    const order: string[] = [];
    const stack = new CleanupStack();

    stack.add(() => {
      order.push('first');
    });
    stack.add(async () => {
      await Promise.resolve();
      order.push('second');
    });

    await stack.dispose();

    expect(order).toEqual(['second', 'first']);
    expect(stack.state).toBe('disposed');
    expect(stack.size).toBe(0);
  });

  it('allows a registration to be disposed early', async () => {
    const order: string[] = [];
    const stack = new CleanupStack();
    const registration = stack.add(() => {
      order.push('cleanup');
    });

    await registration.dispose();
    await stack.dispose();

    expect(order).toEqual(['cleanup']);
  });

  it('returns the same disposal promise', () => {
    const stack = new CleanupStack();

    expect(stack.dispose()).toBe(stack.dispose());
  });

  it('runs every cleanup and aggregates failures', async () => {
    const order: string[] = [];
    const stack = new CleanupStack();

    stack.add(() => {
      order.push('first');
      throw new Error('first failed');
    });
    stack.add(() => {
      order.push('second');
      throw new Error('second failed');
    });

    const disposal = stack.dispose();
    await expect(disposal).rejects.toBeInstanceOf(AggregateError);
    expect(order).toEqual(['second', 'first']);
    expect(stack.state).toBe('disposed');
  });

  it('rejects registration after disposal starts', async () => {
    const stack = new CleanupStack();
    stack.add(async () => {
      await Promise.resolve();
    });

    const disposal = stack.dispose();

    expect(() => stack.add(() => undefined)).toThrow(ThrexusError);
    await disposal;
  });
});
