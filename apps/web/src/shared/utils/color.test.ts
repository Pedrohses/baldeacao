import { describe, expect, it } from 'vitest';

import { isVeryLight, readableTextColor, toHexColor } from './color';

describe('cores de linha', () => {
  it('escolhe o texto de maior contraste', () => {
    expect(readableTextColor('#FFD700')).toBe('#000000');
    expect(readableTextColor('#C7361F')).toBe('#FFFFFF');
    expect(readableTextColor('002F6C')).toBe('#FFFFFF');
  });

  it('marca cores muito claras para ganhar contorno', () => {
    expect(isVeryLight('#FFFFFF')).toBe(true);
    expect(isVeryLight('#FFD100')).toBe(false);
    expect(isVeryLight('#0082BA')).toBe(false);
  });

  it('normaliza hex do GTFS', () => {
    expect(toHexColor('509e2f')).toBe('#509E2F');
    expect(toHexColor('#0082BA')).toBe('#0082BA');
    expect(toHexColor(null)).toBeNull();
    expect(toHexColor('xyz')).toBeNull();
  });
});
