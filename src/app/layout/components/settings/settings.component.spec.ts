import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SettingsStoreService } from '../../../core/services/settings-store.service';
import { SettingsComponent } from './settings.component';

describe('SettingsComponent prefix form', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('rejects blank input, submits a trimmed prefix and leaves the form ready for another prefix', async () => {
    const add = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        {
          provide: SettingsStoreService,
          useValue: {
            filters: signal([]),
            load: vi.fn(),
            add,
          },
        },
      ],
    });
    const fixture = TestBed.createComponent(SettingsComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    const input: HTMLInputElement =
      fixture.nativeElement.querySelector('.filter-input');
    const submit: HTMLButtonElement =
      fixture.nativeElement.querySelector('.add-btn');
    const form: HTMLFormElement = fixture.nativeElement.querySelector('form');
    expect(submit.disabled).toBe(true);

    input.value = '   ';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    fixture.detectChanges();
    expect(submit.disabled).toBe(true);
    form.dispatchEvent(
      new Event('submit', { bubbles: true, cancelable: true }),
    );
    expect(add).not.toHaveBeenCalled();

    input.value = '  [Users]  ';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    fixture.detectChanges();
    expect(submit.disabled).toBe(false);
    form.dispatchEvent(
      new Event('submit', { bubbles: true, cancelable: true }),
    );
    fixture.detectChanges();
    await fixture.whenStable();

    expect(add).toHaveBeenCalledExactlyOnceWith('[Users]');
    expect(input.value).toBe('');
    expect(submit.disabled).toBe(true);
    expect(document.activeElement).toBe(input);
  });
});
