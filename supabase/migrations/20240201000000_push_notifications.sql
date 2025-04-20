-- Add push notification support

-- Create device_tokens table to store user push notification tokens
CREATE TABLE IF NOT EXISTS public.device_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  device_name TEXT,
  platform TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_used_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, token)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_device_tokens_user_id ON public.device_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_device_tokens_token ON public.device_tokens(token);

-- Function to save or update a device token
CREATE OR REPLACE FUNCTION public.save_device_token(
  p_user_id UUID,
  p_token TEXT,
  p_device_name TEXT,
  p_platform TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  token_id UUID;
BEGIN
  -- Check if token already exists for this user
  SELECT id INTO token_id
  FROM public.device_tokens
  WHERE user_id = p_user_id AND token = p_token;
  
  IF token_id IS NULL THEN
    -- Insert new token
    INSERT INTO public.device_tokens (user_id, token, device_name, platform)
    VALUES (p_user_id, p_token, p_device_name, p_platform)
    RETURNING id INTO token_id;
  ELSE
    -- Update existing token
    UPDATE public.device_tokens
    SET 
      device_name = p_device_name,
      platform = p_platform,
      last_used_at = NOW()
    WHERE id = token_id;
  END IF;
  
  RETURN token_id;
END;
$$;

-- Function to send push notifications for transactions
CREATE OR REPLACE FUNCTION public.notify_transaction_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- This function will be called by a trigger when transactions are updated
  -- In a real implementation, this would queue a notification to be sent by a background worker
  -- For now, we'll just update the unread_transactions array which is already being used
  
  -- When a transaction status changes, notify the relevant party
  IF TG_OP = 'UPDATE' AND OLD.status != NEW.status THEN
    IF NEW.status = 'accepted' THEN
      -- Notify sender when receiver accepts the transaction
      UPDATE public.users
      SET unread_transactions = array_append(unread_transactions, NEW.id::TEXT)
      WHERE id = NEW.sender_id;
    ELSIF NEW.status = 'completed' THEN
      -- Notify both parties when transaction is completed
      UPDATE public.users
      SET unread_transactions = array_append(unread_transactions, NEW.id::TEXT)
      WHERE id IN (NEW.sender_id, NEW.receiver_id);
    ELSIF NEW.status = 'cancelled' THEN
      -- Notify both parties when transaction is cancelled
      UPDATE public.users
      SET unread_transactions = array_append(unread_transactions, NEW.id::TEXT)
      WHERE id IN (NEW.sender_id, NEW.receiver_id);
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for transaction updates
CREATE TRIGGER transaction_notification_trigger
AFTER UPDATE ON public.transactions
FOR EACH ROW
EXECUTE FUNCTION public.notify_transaction_update();