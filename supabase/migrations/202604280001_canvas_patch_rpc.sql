-- merge_canvas_patch(board_id, user_id, patch)
--
-- Merges a partial canvas_state patch into the existing canvas_state for
-- a board in a SINGLE database round-trip. This replaces the 3-step
-- read-then-merge-then-write cycle in the Node server, cutting save
-- latency significantly (especially when the Supabase region is remote).
--
-- Authorization: The caller must be the board owner OR an editor member.
-- Viewers and non-members receive a 'permission_denied' error.
--
-- The patch object may contain any subset of:
--   { elements, appState, files }
-- Only keys present in the patch replace the stored value.
-- For `files`, the patch is shallow-merged ON TOP of the existing files map
-- so that incremental image uploads accumulate correctly.
--
-- Returns:
--   'ok'               – update succeeded
--   'not_found'        – board does not exist
--   'permission_denied'– caller is not an owner/editor

create or replace function public.merge_canvas_patch(
  p_board_id  text,
  p_user_id   text,
  p_patch     jsonb
)
returns text
language plpgsql
security definer          -- runs with the function owner's privileges
set search_path = public
as $$
declare
  v_owner_id  text;
  v_role      text;
  v_current   jsonb;
  v_merged    jsonb;
begin
  -- 1. Fetch the board and verify it exists
  select owner_id, canvas_state
  into   v_owner_id, v_current
  from   public.boards
  where  id = p_board_id;

  if not found then
    return 'not_found';
  end if;

  -- 2. Authorisation check
  if v_owner_id = p_user_id then
    v_role := 'owner';
  else
    select role
    into   v_role
    from   public.board_members
    where  board_id = p_board_id
      and  user_id  = p_user_id;

    if not found or v_role = 'viewer' then
      return 'permission_denied';
    end if;
  end if;

  -- 3. Merge patch into current state
  --    Start with sensible defaults so null canvas_state is handled cleanly.
  v_current := coalesce(v_current, '{}'::jsonb);

  v_merged := jsonb_build_object(
    -- elements: patch wins if present, else keep existing, else empty array
    'elements',
    case
      when p_patch ? 'elements' then p_patch -> 'elements'
      else coalesce(v_current -> 'elements', '[]'::jsonb)
    end,

    -- appState: patch wins if present, else keep existing, else empty object
    'appState',
    case
      when p_patch ? 'appState' then p_patch -> 'appState'
      else coalesce(v_current -> 'appState', '{}'::jsonb)
    end,

    -- files: shallow-merge existing ON TOP OF patch so new files accumulate
    'files',
    coalesce(v_current -> 'files', '{}'::jsonb)
      || coalesce(p_patch -> 'files', '{}'::jsonb)
  );

  -- 4. Write merged state back
  update public.boards
  set    canvas_state   = v_merged,
         last_edited_at = now()
  where  id = p_board_id;

  return 'ok';
end;
$$;

-- Revoke public execute, only the service-role key (used by the Node server)
-- should call this function.
revoke execute on function public.merge_canvas_patch(text, text, jsonb)
  from public, anon, authenticated;
