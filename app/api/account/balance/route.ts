import { NextRequest, NextResponse } from 'next/server';
import { getAccountBalance, getAccountTransactions, createAccountTransaction, deleteAccountTransaction } from '@/lib/db';
import { getCurrentUser } from '@/lib/middleware';

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const balance = getAccountBalance(user.id);
    const transactions = getAccountTransactions(user.id);

    return NextResponse.json({ balance, transactions });
  } catch (error) {
    console.error('Error fetching account balance:', error);
    return NextResponse.json({ error: 'Failed to fetch account balance' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const body = await request.json();
    const { type, amount, notes, date } = body;

    if (!type || !['deposit', 'withdraw'].includes(type)) {
      return NextResponse.json({ error: 'Invalid type. Must be "deposit" or "withdraw"' }, { status: 400 });
    }

    if (!amount || typeof amount !== 'number' || amount <= 0) {
      return NextResponse.json({ error: 'Amount must be a positive number' }, { status: 400 });
    }

    // For withdrawals, check sufficient balance
    if (type === 'withdraw') {
      const currentBalance = getAccountBalance(user.id);
      if (amount > currentBalance) {
        return NextResponse.json({ error: 'Insufficient balance' }, { status: 400 });
      }
    }

    const transaction = createAccountTransaction({
      user_id: user.id,
      type,
      amount,
      notes: notes || null,
      date: date || new Date().toISOString().split('T')[0],
    });

    const balance = getAccountBalance(user.id);

    return NextResponse.json({ transaction, balance });
  } catch (error) {
    console.error('Error creating account transaction:', error);
    return NextResponse.json({ error: 'Failed to process transaction' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Transaction ID required' }, { status: 400 });
    }

    const deleted = deleteAccountTransaction(parseInt(id), user.id);
    if (!deleted) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
    }

    const balance = getAccountBalance(user.id);
    return NextResponse.json({ success: true, balance });
  } catch (error) {
    console.error('Error deleting account transaction:', error);
    return NextResponse.json({ error: 'Failed to delete transaction' }, { status: 500 });
  }
}
