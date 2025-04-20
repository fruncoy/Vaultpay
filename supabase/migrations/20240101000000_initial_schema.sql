-- Create extension for UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create users table
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  phone TEXT,
  location TEXT,
  vault_id TEXT NOT NULL UNIQUE,
  balance DECIMAL(12, 2) NOT NULL DEFAULT 1000.00,
  escrow_balance DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  unread_transactions TEXT[] DEFAULT '{}'
);

-- Create transactions table
CREATE TABLE IF NOT EXISTS public.transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  vtid TEXT NOT NULL UNIQUE,
  sender_id UUID NOT NULL REFERENCES public.users(id),
  receiver_id UUID NOT NULL REFERENCES public.users(id),
  amount DECIMAL(12, 2) NOT NULL CHECK (amount > 0),
  status TEXT NOT NULL CHECK (status IN ('pending', 'accepted', 'completed', 'cancelled')),
  conditions JSONB DEFAULT '{}',
  time_limit INTEGER NOT NULL, -- Time limit in hours
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  accepted_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  cancelled_at TIMESTAMP WITH TIME ZONE,
  CONSTRAINT different_users CHECK (sender_id != receiver_id)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_vault_id ON public.users(vault_id);
CREATE INDEX IF NOT EXISTS idx_transactions_sender_id ON public.transactions(sender_id);
CREATE INDEX IF NOT EXISTS idx_transactions_receiver_id ON public.transactions(receiver_id);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON public.transactions(status);
CREATE INDEX IF NOT EXISTS idx_transactions_vtid ON public.transactions(vtid);

-- Function to generate a unique VID (Vault ID) for users
CREATE OR REPLACE FUNCTION public.generate_vid()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  new_vid TEXT;
  vid_exists BOOLEAN;
BEGIN
  LOOP
    -- Generate a random 8-character alphanumeric string
    new_vid := UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 8));
    
    -- Check if it already exists
    SELECT EXISTS(SELECT 1 FROM public.users WHERE vault_id = new_vid) INTO vid_exists;
    
    -- Exit loop if unique
    EXIT WHEN NOT vid_exists;
  END LOOP;
  
  RETURN new_vid;
END;
$$;

-- Function to generate a unique VTID (Vault Transaction ID) for transactions
CREATE OR REPLACE FUNCTION public.generate_vtid()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  new_vtid TEXT;
  vtid_exists BOOLEAN;
BEGIN
  LOOP
    -- Generate a random 12-character alphanumeric string
    new_vtid := UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 12));
    
    -- Check if it already exists
    SELECT EXISTS(SELECT 1 FROM public.transactions WHERE vtid = new_vtid) INTO vtid_exists;
    
    -- Exit loop if unique
    EXIT WHEN NOT vtid_exists;
  END LOOP;
  
  RETURN new_vtid;
END;
$$;

-- Function to create a transaction and handle escrow
CREATE OR REPLACE FUNCTION public.create_transaction_with_escrow(
  p_sender_id UUID,
  p_receiver_id UUID,
  p_amount DECIMAL,
  p_conditions JSONB,
  p_time_limit INTEGER
)
RETURNS public.transactions
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_transaction public.transactions;
  new_vtid TEXT;
  sender_balance DECIMAL;
  sender_escrow_balance DECIMAL;
BEGIN
  -- Check if sender has sufficient balance
  SELECT balance, escrow_balance INTO sender_balance, sender_escrow_balance
  FROM public.users
  WHERE id = p_sender_id;
  
  IF sender_balance < p_amount THEN
    RAISE EXCEPTION 'Insufficient balance';
  END IF;
  
  -- Generate a new VTID
  new_vtid := public.generate_vtid();
  
  -- Begin transaction
  BEGIN
    -- Deduct amount from sender's balance and add to escrow
    UPDATE public.users
    SET 
      balance = balance - p_amount,
      escrow_balance = escrow_balance + p_amount
    WHERE id = p_sender_id;
    
    -- Create the transaction record
    INSERT INTO public.transactions (
      vtid,
      sender_id,
      receiver_id,
      amount,
      status,
      conditions,
      time_limit
    ) VALUES (
      new_vtid,
      p_sender_id,
      p_receiver_id,
      p_amount,
      'pending',
      p_conditions,
      p_time_limit
    ) RETURNING * INTO new_transaction;
    
    -- Add transaction to receiver's unread list
    UPDATE public.users
    SET unread_transactions = array_append(unread_transactions, new_transaction.id::TEXT)
    WHERE id = p_receiver_id;
    
    -- Commit transaction
    RETURN new_transaction;
  EXCEPTION
    WHEN OTHERS THEN
      -- Rollback in case of any error
      RAISE;
  END;
END;
$$;

-- Function to update transaction status and handle balance transfers
CREATE OR REPLACE FUNCTION public.update_transaction_status(
  p_transaction_id UUID,
  p_new_status TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  transaction_record public.transactions;
BEGIN
  -- Get the transaction
  SELECT * INTO transaction_record
  FROM public.transactions
  WHERE id = p_transaction_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transaction not found';
  END IF;
  
  -- Check if status change is valid
  IF transaction_record.status = p_new_status THEN
    RETURN; -- No change needed
  END IF;
  
  -- Begin transaction
  BEGIN
    IF p_new_status = 'accepted' THEN
      -- Update transaction status to accepted
      UPDATE public.transactions
      SET 
        status = 'accepted',
        accepted_at = NOW()
      WHERE id = p_transaction_id;
      
      -- Add to sender's unread list to notify them
      UPDATE public.users
      SET unread_transactions = array_append(unread_transactions, p_transaction_id::TEXT)
      WHERE id = transaction_record.sender_id;
      
    ELSIF p_new_status = 'completed' THEN
      -- Check if transaction is in accepted state
      IF transaction_record.status != 'accepted' THEN
        RAISE EXCEPTION 'Transaction must be accepted before completion';
      END IF;
      
      -- Update transaction status to completed
      UPDATE public.transactions
      SET 
        status = 'completed',
        completed_at = NOW()
      WHERE id = p_transaction_id;
      
      -- Transfer from sender's escrow to receiver's balance
      UPDATE public.users
      SET escrow_balance = escrow_balance - transaction_record.amount
      WHERE id = transaction_record.sender_id;
      
      UPDATE public.users
      SET balance = balance + transaction_record.amount
      WHERE id = transaction_record.receiver_id;
      
      -- Add to receiver's unread list to notify them
      UPDATE public.users
      SET unread_transactions = array_append(unread_transactions, p_transaction_id::TEXT)
      WHERE id = transaction_record.receiver_id;
      
    ELSIF p_new_status = 'cancelled' THEN
      -- Update transaction status to cancelled
      UPDATE public.transactions
      SET 
        status = 'cancelled',
        cancelled_at = NOW()
      WHERE id = p_transaction_id;
      
      -- Return funds from escrow to sender's balance
      UPDATE public.users
      SET 
        balance = balance + transaction_record.amount,
        escrow_balance = escrow_balance - transaction_record.amount
      WHERE id = transaction_record.sender_id;
      
      -- Notify both parties
      UPDATE public.users
      SET unread_transactions = array_append(unread_transactions, p_transaction_id::TEXT)
      WHERE id IN (transaction_record.sender_id, transaction_record.receiver_id);
    ELSE
      RAISE EXCEPTION 'Invalid status: %', p_new_status;
    END IF;
  EXCEPTION
    WHEN OTHERS THEN
      -- Rollback in case of any error
      RAISE;
  END;
END;
$$;

-- Function to process expired transactions
CREATE OR REPLACE FUNCTION public.process_expired_transactions()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  expired_transaction public.transactions;
  expired_cursor CURSOR FOR
    SELECT *
    FROM public.transactions
    WHERE 
      status = 'pending' AND
      created_at + (time_limit * INTERVAL '1 hour') < NOW();
BEGIN
  -- Process each expired transaction
  FOR expired_transaction IN expired_cursor LOOP
    -- Cancel the transaction and return funds to sender
    PERFORM public.update_transaction_status(expired_transaction.id, 'cancelled');
  END LOOP;
END;
$$;

-- Create a trigger function to set vault_id on new user creation
CREATE OR REPLACE FUNCTION public.set_vault_id()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Set vault_id if not provided
  IF NEW.vault_id IS NULL THEN
    NEW.vault_id := public.generate_vid();
  END IF;
  RETURN NEW;
END;
$$;

-- Create trigger to set vault_id before insert
CREATE TRIGGER set_vault_id_trigger
  BEFORE INSERT ON public.users
  FOR EACH ROW
  WHEN (NEW.vault_id IS NULL)
  EXECUTE FUNCTION public.set_vault_id();

-- Create a trigger function to set vtid on new transaction creation
CREATE OR REPLACE FUNCTION public.set_vtid()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Set vtid if not provided
  IF NEW.vtid IS NULL THEN
    NEW.vtid := public.generate_vtid();
  END IF;
  RETURN NEW;
END;
$$;

-- Create trigger to set vtid before insert
CREATE TRIGGER set_vtid_trigger
  BEFORE INSERT ON public.transactions
  FOR EACH ROW
  WHEN (NEW.vtid IS NULL)
  EXECUTE FUNCTION public.set_vtid();