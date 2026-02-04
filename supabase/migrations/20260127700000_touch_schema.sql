-- Force schema reload by DDL
CREATE TABLE public._schema_cache_buster (id int);
DROP TABLE public._schema_cache_buster;
NOTIFY pgrst, 'reload schema';
