import * as db from '../database';
import { initDatabase } from '../../database/init';

// Mock the whole init module
jest.mock('../../database/init');

const mockGetAllAsync = jest.fn();
const mockGetFirstAsync = jest.fn();

describe('Database Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Ensure initDatabase returns our mocks
    (initDatabase as jest.Mock).mockResolvedValue({
      getAllAsync: mockGetAllAsync,
      getFirstAsync: mockGetFirstAsync,
    });
  });

  test('getTxt returns mapped text symbols', async () => {
    mockGetAllAsync.mockResolvedValue([
      { id: 1, txtsym: 'Word1', aya: null },
      { id: 2, txtsym: 'Word2', aya: 1 },
    ]);

    const result = await db.getTxt(1, 2);
    expect(result).toEqual(['Word1', 'Word2']);
  });

  test('getTxt with ayaMark formatting', async () => {
    mockGetAllAsync.mockResolvedValue([
      { id: 1, txtsym: 'الحمد', aya: 2 },
    ]);

    const result = await db.getTxt(1, 1, 'ayaMark');
    expect(result).toEqual(['الحمد (2)']);
  });

  test('getTxts returns ordered results', async () => {
    mockGetAllAsync.mockResolvedValue([
      { id: 5, txtsym: 'E' },
      { id: 2, txtsym: 'B' },
    ]);

    const result = await db.getTxts([2, 5]);
    expect(result).toEqual(['B', 'E']);
  });

  test('getSim2Cnt returns numeric value', async () => {
    mockGetFirstAsync.mockResolvedValue({ sim2: 42 });
    const count = await db.getSim2Cnt(100);
    expect(count).toBe(42);
  });

  test('getUniqueSim1Not2Plus1 parses JSON string', async () => {
    mockGetFirstAsync.mockResolvedValue({ sim1not2p1: '[10, 20, 30]' });
    const result = await db.getUniqueSim1Not2Plus1(500);
    expect(result).toEqual([10, 20, 30]);
  });

  test('getAyaNumberOf finds first aya index', async () => {
    mockGetFirstAsync.mockResolvedValue({ aya: 7 });
    const aya = await db.getAyaNumberOf(1234);
    expect(aya).toBe(7);
  });

  test('checkAyaStart verifies exact ID match', async () => {
    mockGetFirstAsync.mockResolvedValue({ id: 100 });
    
    const isStartTrue = await db.checkAyaStart(100);
    expect(isStartTrue).toBe(true);

    const isStartFalse = await db.checkAyaStart(101);
    expect(isStartFalse).toBe(false);
  });
});
