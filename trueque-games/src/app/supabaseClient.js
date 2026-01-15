import { createClient } from '@supabase/supabase-js'

// PEGA TU URL DENTRO DE LAS COMILLAS:
const supabaseUrl = 'https://ifoeygzhwzyvjwurmiev.supabase.co' 

// PEGA TU CLAVE ANON DENTRO DE LAS COMILLAS:
const supabaseKey = 'sb_publishable_0kV_iORGenQT5EqX7myBAA_67B48NHg' 

export const supabase = createClient(supabaseUrl, supabaseKey)