# VaultPay SQL Migrations

This directory contains SQL migrations for the VaultPay escrow payment platform. These migrations set up the database schema, functions, and scheduled jobs necessary for the application to work.

## Migration Files

### 1. `20240101000000_initial_schema.sql`

This migration creates the core database structure:

- **Tables**:
  - `users`: Stores user information including name, email, VID (Vault ID), balance, and escrow balance
  - `transactions`: Stores transaction details including VTID (Vault Transaction ID), sender, receiver, amount, status, and time limits

- **Functions**:
  - `generate_vid()`: Generates unique Vault IDs for users
  - `generate_vtid()`: Generates unique Vault Transaction IDs for transactions
  - `create_transaction_with_escrow()`: Creates a new transaction and moves funds from sender's balance to escrow
  - `update_transaction_status()`: Updates transaction status and handles fund transfers between accounts
  - `process_expired_transactions()`: Automatically cancels expired transactions and returns funds to senders

- **Triggers**:
  - `set_vault_id_trigger`: Automatically sets a VID for new users if not provided
  - `set_vtid_trigger`: Automatically sets a VTID for new transactions if not provided

### 2. `20240101000001_scheduled_jobs.sql`

This migration sets up scheduled jobs:

- Creates a scheduled job that runs hourly to process expired transactions

## Transaction Flow

1. **Creating a Transaction**:
   - Sender initiates a transaction
   - System verifies sender has sufficient balance
   - Funds are moved from sender's balance to escrow
   - Transaction is created with 'pending' status
   - Receiver is notified of the pending transaction

2. **Accepting a Transaction**:
   - Receiver accepts the transaction
   - Transaction status changes to 'accepted'
   - Sender is notified that the transaction was accepted

3. **Completing a Transaction**:
   - Sender approves that conditions are met
   - Transaction status changes to 'completed'
   - Funds are moved from escrow to receiver's balance
   - Receiver is notified that the transaction was completed

4. **Cancelling a Transaction**:
   - Either party cancels the transaction OR time limit expires
   - Transaction status changes to 'cancelled'
   - Funds are returned from escrow to sender's balance
   - Both parties are notified of the cancellation

## Applying Migrations

To apply these migrations to your Supabase project:

1. Make sure you have the Supabase CLI installed
2. Run: `supabase db push`

Or apply them manually through the Supabase dashboard SQL editor.