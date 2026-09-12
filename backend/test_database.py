from database import supabase

response = (
    supabase
    .table("incidents")
    .select("*")
    .limit(5)
    .execute()
)

print("Database connection successful.")
print(response.data)