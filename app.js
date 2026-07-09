import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm'

export const supabase = createClient(
  'https://elrmeekxaxcyxdyzqtzg.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVscm1lZWt4YXhjeXhkeXpxdHpnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM2MDA4MTIsImV4cCI6MjA5OTE3NjgxMn0.XfLB_ZPMbnnlK-TJX05vVipk6XxZPZlq95sbIAwDwFs'
)
export async function login(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
  return data
}
