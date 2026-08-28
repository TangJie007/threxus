/**
 * 命令服务：可撤销命令队列（编辑器 / AI Agent 入口）。
 */

import { Injectable } from '@threxus/core';

export interface Command {
  readonly label?: string;
  execute(): void | Promise<void>;
  undo(): void | Promise<void>;
}

@Injectable()
export class CommandService {
  private readonly undoStack: Command[] = [];
  private readonly redoStack: Command[] = [];

  async execute(command: Command): Promise<void> {
    await command.execute();
    this.undoStack.push(command);
    this.redoStack.length = 0;
  }

  async undo(): Promise<boolean> {
    const command = this.undoStack.pop();
    if (!command) {
      return false;
    }
    await command.undo();
    this.redoStack.push(command);
    return true;
  }

  async redo(): Promise<boolean> {
    const command = this.redoStack.pop();
    if (!command) {
      return false;
    }
    await command.execute();
    this.undoStack.push(command);
    return true;
  }

  canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  clear(): void {
    this.undoStack.length = 0;
    this.redoStack.length = 0;
  }
}
