-- Debugging RLS: Redefine _c20_is_city_accessible to throw error with JWT details on failure

CREATE OR REPLACE FUNCTION public._c20_is_city_accessible(target_city_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
    v_role text;
    v_allowed_cities uuid[];
    v_single_city uuid;
    v_jwt jsonb;
BEGIN
    v_jwt := auth.jwt();
    
    -- Get role from JWT
    v_role := COALESCE(
        v_jwt ->> 'app_role',
        v_jwt ->> 'role',
        'anon'
    );
    
    -- Admins and service_role have full access
    IF v_role IN ('admin', 'super_admin', 'service_role') THEN
        RETURN true;
    END IF;
    
    -- Try to get allowed_city_ids array (multi-city support)
    BEGIN
        v_allowed_cities := ARRAY(
            SELECT jsonb_array_elements_text(
                (v_jwt -> 'app_metadata' -> 'allowed_city_ids')
            )::uuid
        );
    EXCEPTION WHEN OTHERS THEN
        v_allowed_cities := NULL;
    END;
    
    -- If allowed_city_ids exists, check if target city is in the list
    IF v_allowed_cities IS NOT NULL AND array_length(v_allowed_cities, 1) > 0 THEN
        IF target_city_id = ANY(v_allowed_cities) THEN
            RETURN true;
        END IF;
    END IF;
    
    -- Fallback to single city_id claim
    v_single_city := (v_jwt -> 'app_metadata' ->> 'city_id')::uuid;
    IF v_single_city IS NOT NULL THEN
        IF target_city_id = v_single_city THEN
            RETURN true;
        END IF;
    END IF;
    
    -- Debug Failure: Throw exception with JWT details
    RAISE EXCEPTION 'RLS_DEBUG: Access Denied. Target=%, JWT=%', target_city_id, v_jwt;
    
    RETURN false;
END;
$$;
