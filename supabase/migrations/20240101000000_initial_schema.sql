-- Initial schema for SharedListsApp distributed CRDT system
-- Migration: 20240101000000_initial_schema.sql

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Lists table (metadata and permissions)
CREATE TABLE IF NOT EXISTS lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  yjs_document_id TEXT UNIQUE NOT NULL, -- The Yjs document UUID
  owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  deleted_by UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  deleted_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- List participants (sharing)
CREATE TABLE IF NOT EXISTS list_participants (
  list_id UUID REFERENCES lists(id),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT CHECK (role IN ('owner', 'participant')) DEFAULT 'participant',
  added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (list_id, user_id)
);

-- User profiles
CREATE TABLE IF NOT EXISTS user_profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- CRDT updates (for syncing)
CREATE TABLE IF NOT EXISTS crdt_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  yjs_document_id TEXT NOT NULL, -- References the Yjs document UUID
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id TEXT, -- Client identifier to filter out own updates
  update_data JSONB NOT NULL, -- Yjs update data stored as number array (y-supabase approach)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- CRDT snapshots (periodic full state)
CREATE TABLE IF NOT EXISTS crdt_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  yjs_document_id TEXT NOT NULL,
  snapshot_data BYTEA NOT NULL, -- Full Yjs document state
  version INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);



-- List invites
CREATE TABLE IF NOT EXISTS list_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id UUID REFERENCES lists(id) ON DELETE CASCADE,
  yjs_document_id TEXT NOT NULL, -- Store the Yjs document ID for easy access
  invited_by UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  invitation_for TEXT NOT NULL,
  token TEXT UNIQUE NOT NULL,
  status TEXT CHECK (status IN ('pending', 'accepted', 'expired')) DEFAULT 'pending',
  accepted_by UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '7 days')
);

-- Add foreign key constraints with CASCADE delete for proper referential integrity
ALTER TABLE crdt_updates 
ADD CONSTRAINT fk_crdt_updates_list 
FOREIGN KEY (yjs_document_id) 
REFERENCES lists(yjs_document_id) 
ON DELETE CASCADE;

ALTER TABLE crdt_snapshots 
ADD CONSTRAINT fk_crdt_snapshots_list 
FOREIGN KEY (yjs_document_id) 
REFERENCES lists(yjs_document_id) 
ON DELETE CASCADE;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_lists_owner_id ON lists(owner_id);
CREATE INDEX IF NOT EXISTS idx_lists_yjs_document_id ON lists(yjs_document_id);
CREATE INDEX IF NOT EXISTS idx_list_participants_user_id ON list_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_crdt_updates_yjs_document_id ON crdt_updates(yjs_document_id);
CREATE INDEX IF NOT EXISTS idx_crdt_updates_created_at ON crdt_updates(created_at);
CREATE INDEX IF NOT EXISTS idx_crdt_updates_client_id ON crdt_updates(client_id);
CREATE INDEX IF NOT EXISTS idx_crdt_updates_document_client ON crdt_updates(yjs_document_id, client_id);
CREATE INDEX IF NOT EXISTS idx_crdt_snapshots_yjs_document_id ON crdt_snapshots(yjs_document_id);
CREATE INDEX IF NOT EXISTS idx_crdt_snapshots_version ON crdt_snapshots(version);
CREATE INDEX IF NOT EXISTS idx_lists_deleted_at ON lists(deleted_at);
CREATE INDEX IF NOT EXISTS idx_list_invites_token ON list_invites(token);
CREATE INDEX IF NOT EXISTS idx_list_invites_status ON list_invites(status);

-- Helper function to check if user is a participant (bypasses RLS)
CREATE OR REPLACE FUNCTION public.is_list_participant(_list_id UUID, _user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.list_participants
    WHERE list_id = _list_id
      AND user_id = _user_id
  );
$$;

-- Lock it down: only allow app roles to execute
REVOKE ALL ON FUNCTION public.is_list_participant(UUID, UUID) FROM public;
GRANT EXECUTE ON FUNCTION public.is_list_participant(UUID, UUID) TO authenticated, anon;

-- Row Level Security (RLS) policies

-- Enable RLS on all tables
ALTER TABLE lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE list_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE crdt_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE crdt_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE list_invites ENABLE ROW LEVEL SECURITY;

-- Lists policies
CREATE POLICY "Participants can view lists" ON lists
  FOR SELECT USING (
    auth.uid() = owner_id OR 
    public.is_list_participant(lists.id, (SELECT auth.uid()))
  );

CREATE POLICY "Users can create lists" ON lists
  FOR INSERT WITH CHECK ((SELECT auth.uid()) = owner_id);

CREATE POLICY "Participants can update lists" ON lists
  FOR UPDATE USING (
    auth.uid() = owner_id OR 
    public.is_list_participant(lists.id, (SELECT auth.uid()))
  );

-- List participants policies
CREATE POLICY "Participants can view participants" ON list_participants
  FOR SELECT USING (
    public.is_list_participant(list_participants.list_id, (SELECT auth.uid()))
  );

CREATE POLICY "Owners can manage participants" ON list_participants
  FOR ALL USING (
    public.is_list_participant(list_participants.list_id, (SELECT auth.uid()))
  );

-- Allow the trigger function to insert participants (bypasses RLS)
CREATE POLICY "Trigger can insert participants" ON list_participants
  FOR INSERT WITH CHECK (true);

-- Allow users to remove themselves from list_participants table (for leaving lists)
CREATE POLICY "Users can remove themselves from participants" ON list_participants
  FOR DELETE USING (
    user_id = (SELECT auth.uid())
  );



-- Function to automatically add user as participant when invite is accepted
CREATE OR REPLACE FUNCTION public.handle_invite_accepted()
RETURNS TRIGGER AS $$
BEGIN
  -- Only proceed if accepted_by is set (meaning someone accepted the invite)
  IF NEW.accepted_by IS NOT NULL AND OLD.accepted_by IS NULL THEN
    -- Add the user as a participant
    INSERT INTO public.list_participants (list_id, user_id, role, added_at)
    VALUES (NEW.list_id, NEW.accepted_by, 'participant', NOW())
    ON CONFLICT (list_id, user_id) DO NOTHING;
    
    -- Also update the status to 'accepted' if it's not already
    IF NEW.status != 'accepted' THEN
      NEW.status := 'accepted';
    END IF;
  END IF;
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log the error but don't fail the invite update
    RAISE WARNING 'Failed to add user as participant: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- Function to accept an invite (bypasses RLS)
CREATE OR REPLACE FUNCTION public.accept_invite(invite_token TEXT, user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  invite_record RECORD;
BEGIN
  -- Get the invite by token
  SELECT * INTO invite_record 
  FROM list_invites 
  WHERE token = invite_token 
    AND status = 'pending' 
    AND expires_at > NOW();
  
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;
  
  -- Update the invite
  UPDATE list_invites 
  SET accepted_by = user_id, status = 'accepted'
  WHERE id = invite_record.id;
  
  RETURN TRUE;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Failed to accept invite: %', SQLERRM;
    RETURN FALSE;
END;
$$;

-- Trigger to automatically add user as participant when invite is accepted
CREATE TRIGGER trigger_invite_accepted
  BEFORE UPDATE ON list_invites
  FOR EACH ROW
  EXECUTE FUNCTION handle_invite_accepted();

-- User profiles policies
CREATE POLICY "Users can view all profiles" ON user_profiles
  FOR SELECT USING (true);

CREATE POLICY "Users can update their own profile" ON user_profiles
  FOR UPDATE USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can insert their own profile" ON user_profiles
  FOR INSERT WITH CHECK ((SELECT auth.uid()) = user_id);

-- Allow the trigger function to insert profiles (bypasses RLS)
CREATE POLICY "Trigger can insert profiles" ON user_profiles
  FOR INSERT WITH CHECK (true);

-- CRDT updates policies
CREATE POLICY "Participants can view updates for lists" ON crdt_updates
  FOR SELECT USING (
    public.is_list_participant(
      (SELECT id FROM lists WHERE lists.yjs_document_id = crdt_updates.yjs_document_id LIMIT 1),
      (SELECT auth.uid())
    )
  );

CREATE POLICY "Participants can insert updates for lists" ON crdt_updates
  FOR INSERT WITH CHECK (
    (SELECT auth.uid()) = user_id AND
    public.is_list_participant(
      (SELECT id FROM lists WHERE lists.yjs_document_id = crdt_updates.yjs_document_id LIMIT 1),
      (SELECT auth.uid())
    )
  );

CREATE POLICY "Participants can delete updates for lists" ON crdt_updates
  FOR DELETE USING (
    public.is_list_participant(
      (SELECT id FROM lists WHERE lists.yjs_document_id = crdt_updates.yjs_document_id LIMIT 1),
      (SELECT auth.uid())
    )
  );

-- CRDT snapshots policies
CREATE POLICY "Participants can view snapshots for lists" ON crdt_snapshots
  FOR SELECT USING (
    public.is_list_participant(
      (SELECT id FROM lists WHERE lists.yjs_document_id = crdt_snapshots.yjs_document_id LIMIT 1),
      (SELECT auth.uid())
    )
  );

CREATE POLICY "Participants can insert snapshots for lists" ON crdt_snapshots
  FOR INSERT WITH CHECK (
    public.is_list_participant(
      (SELECT id FROM lists WHERE lists.yjs_document_id = crdt_snapshots.yjs_document_id LIMIT 1),
      (SELECT auth.uid())
    )
  );

CREATE POLICY "Participants can delete snapshots for lists" ON crdt_snapshots
  FOR DELETE USING (
    public.is_list_participant(
      (SELECT id FROM lists WHERE lists.yjs_document_id = crdt_snapshots.yjs_document_id LIMIT 1),
      (SELECT auth.uid())
    )
  );



-- List invites policies
CREATE POLICY "Users can view invites they sent" ON list_invites
  FOR SELECT USING (
    (SELECT auth.uid()) = invited_by
  );

CREATE POLICY "List owners can view all invites for their lists" ON list_invites
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM lists 
      WHERE lists.id = list_invites.list_id 
      AND lists.owner_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "Public can view invites by token" ON list_invites
  FOR SELECT USING (
    token IS NOT NULL
  );

CREATE POLICY "Owners can create invites" ON list_invites
  FOR INSERT WITH CHECK (
    (SELECT auth.uid()) = invited_by AND
    EXISTS (
      SELECT 1 FROM lists 
      WHERE lists.id = list_invites.list_id 
      AND lists.owner_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "Users can update invites they created" ON list_invites
  FOR UPDATE USING ((SELECT auth.uid()) = invited_by);

CREATE POLICY "Users can accept pending invites" ON list_invites
  FOR UPDATE USING (
    status = 'pending' AND 
    expires_at > NOW() AND
    accepted_by IS NULL
  );



CREATE POLICY "Users can delete invites they created" ON list_invites
  FOR DELETE USING (
    (SELECT auth.uid()) = invited_by
  );

CREATE POLICY "List owners can delete any invites for their lists" ON list_invites
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM lists 
      WHERE lists.id = list_invites.list_id 
      AND lists.owner_id = (SELECT auth.uid())
    )
  );

-- Functions for common operations

-- Function to automatically add owner as participant
CREATE OR REPLACE FUNCTION public.add_owner_as_participant()
RETURNS TRIGGER AS $$
BEGIN
  -- Use a direct INSERT with SECURITY DEFINER to bypass RLS
  INSERT INTO public.list_participants (list_id, user_id, role)
  VALUES (NEW.id, NEW.owner_id, 'owner')
  ON CONFLICT (list_id, user_id) DO NOTHING;
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log the error but don't fail the list creation
    RAISE WARNING 'Failed to add owner as participant: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- Trigger to automatically add owner as participant (temporarily disabled)
-- CREATE TRIGGER trigger_add_owner_as_participant
--   AFTER INSERT ON lists
--   FOR EACH ROW
--   EXECUTE FUNCTION add_owner_as_participant();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- Triggers to automatically update updated_at
CREATE TRIGGER trigger_update_lists_updated_at
  BEFORE UPDATE ON lists
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_update_user_profiles_updated_at
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function to automatically create user profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (user_id, display_name)
  VALUES (
    NEW.id,
    COALESCE(
      CASE WHEN NEW.raw_user_meta_data IS NOT NULL THEN NEW.raw_user_meta_data->>'display_name' END,
      CASE WHEN NEW.raw_user_meta_data IS NOT NULL THEN NEW.raw_user_meta_data->>'full_name' END,
      'User'
    )
  )
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log the error but don't fail the user creation
    RAISE WARNING 'Failed to create user profile: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- Trigger to automatically create user profile
CREATE TRIGGER trigger_handle_new_user
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- Function to handle user profile updates when auth.users changes
CREATE OR REPLACE FUNCTION public.handle_user_profile_update()
RETURNS TRIGGER AS $$
BEGIN
  -- Update the user_profiles table when auth.users changes
  UPDATE public.user_profiles 
  SET 
    display_name = COALESCE(
      NEW.raw_user_meta_data->>'display_name',
      NEW.raw_user_meta_data->>'full_name',
      OLD.raw_user_meta_data->>'display_name',
      OLD.raw_user_meta_data->>'full_name',
      'User'
    ),
    updated_at = NOW()
  WHERE user_id = NEW.id;
  
  -- If no rows were updated, the profile might not exist yet, so create it
  IF NOT FOUND THEN
    INSERT INTO public.user_profiles (user_id, display_name)
    VALUES (
      NEW.id,
      COALESCE(
        NEW.raw_user_meta_data->>'display_name',
        NEW.raw_user_meta_data->>'full_name',
        'User'
      )
    );
  END IF;
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log the error but don't fail the user update
    RAISE WARNING 'Failed to update user profile: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- Trigger to automatically update user profile when auth.users changes
CREATE TRIGGER trigger_handle_user_profile_update
  AFTER UPDATE ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_user_profile_update();

-- Lock it down: only allow app roles to execute
REVOKE ALL ON FUNCTION public.handle_user_profile_update() FROM public;
GRANT EXECUTE ON FUNCTION public.handle_user_profile_update() TO authenticated, anon;

-- Function to clean up CRDT data and list participants when a list is soft deleted
CREATE OR REPLACE FUNCTION public.cleanup_crdt_data_on_list_delete()
RETURNS TRIGGER AS $$
BEGIN
  -- Only clean up data when a list is being soft deleted (deleted_by is set)
  IF NEW.deleted_by IS NOT NULL AND OLD.deleted_by IS NULL THEN
    -- Delete all CRDT updates for this document
    DELETE FROM public.crdt_updates 
    WHERE yjs_document_id = NEW.yjs_document_id;
    
    -- Delete all CRDT snapshots for this document
    DELETE FROM public.crdt_snapshots 
    WHERE yjs_document_id = NEW.yjs_document_id;
    
    -- Delete all list invites for this list
    DELETE FROM public.list_invites 
    WHERE list_id = NEW.id;
    
    -- Log the cleanup (optional, for debugging)
    RAISE NOTICE 'Cleaned up CRDT data and invites for document: % (list_id: %)', NEW.yjs_document_id, NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';


-- Lock it down: only allow app roles to execute
REVOKE ALL ON FUNCTION public.cleanup_crdt_data_on_list_delete() FROM public;
GRANT EXECUTE ON FUNCTION public.cleanup_crdt_data_on_list_delete() TO authenticated, anon;

-- Trigger to automatically clean up CRDT data when a list is soft deleted
CREATE TRIGGER trigger_cleanup_crdt_data_on_list_delete
  AFTER UPDATE ON lists
  FOR EACH ROW
  EXECUTE FUNCTION cleanup_crdt_data_on_list_delete();

-- Enable realtime for tables that need live updates
ALTER PUBLICATION supabase_realtime ADD TABLE lists;
ALTER PUBLICATION supabase_realtime ADD TABLE crdt_updates;
