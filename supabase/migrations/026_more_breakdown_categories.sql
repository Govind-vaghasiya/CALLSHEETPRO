-- ============================================================
-- 026_more_breakdown_categories.sql
-- More breakdown categories (the standard industry set):
--   SET_DRESSING      set dressing (furniture, decor placed on the set)
--   GREENERY          plants, trees, landscaping
--   CAMERA            camera equipment (cranes, drones, special lenses, rigs)
--   LIGHTING_GRIP     lighting & grip (lights, generators, dollies, track)
--   SECURITY          security, police, traffic control
--   ADDITIONAL_LABOR  additional crew / labour for the scene
-- Safe to run more than once. Only adds; nothing is changed or deleted.
-- ============================================================

alter type scene_element_type add value if not exists 'SET_DRESSING';
alter type scene_element_type add value if not exists 'GREENERY';
alter type scene_element_type add value if not exists 'CAMERA';
alter type scene_element_type add value if not exists 'LIGHTING_GRIP';
alter type scene_element_type add value if not exists 'SECURITY';
alter type scene_element_type add value if not exists 'ADDITIONAL_LABOR';
