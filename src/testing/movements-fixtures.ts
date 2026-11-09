// Datos ficticios de cuentas, categorías y movimientos para las pruebas (nunca datos reales).
import type { Account, Category, Transaction, TransactionList } from '@/features/movements/movements-view';

const stamp = '2026-11-01T12:00:00Z';

export function accountFixture(patch: Partial<Account> = {}): Account {
  return {
    id: 'acc-cash',
    name: 'Cash wallet',
    type: 'Cash',
    currency: 'COP',
    openingBalance: 0,
    balance: 0,
    isArchived: false,
    hasTransactions: false,
    createdAt: stamp,
    updatedAt: stamp,
    ...patch,
  };
}

export function categoryFixture(patch: Partial<Category> = {}): Category {
  return {
    id: 'cat-food',
    name: 'Food',
    kind: 'Expense',
    color: 'green',
    icon: 'cart',
    isArchived: false,
    hasTransactions: false,
    createdAt: stamp,
    updatedAt: stamp,
    ...patch,
  };
}

export function transactionFixture(patch: Partial<Transaction> = {}): Transaction {
  return {
    id: 'tx-1',
    type: 'Expense',
    accountId: 'acc-cash',
    accountName: 'Cash wallet',
    toAccountId: null,
    toAccountName: null,
    categoryId: 'cat-food',
    categoryName: 'Food',
    categoryColor: 'green',
    categoryIcon: 'cart',
    amount: 38_900,
    currency: 'COP',
    date: '2026-11-06',
    description: null,
    note: null,
    createdAt: stamp,
    updatedAt: stamp,
    recurringPaymentId: null,
    ...patch,
  };
}

export function transactionList(items: Transaction[], patch: Partial<TransactionList> = {}): TransactionList {
  return { items, page: 1, pageSize: 50, totalCount: items.length, totals: [], ...patch };
}
