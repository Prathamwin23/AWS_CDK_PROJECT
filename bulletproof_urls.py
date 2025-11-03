from django.contrib import admin
from django.urls import path, include
from django.http import JsonResponse, HttpResponse
import sys
import os

def health_check(request):
    return JsonResponse({'status': 'healthy'})

# BULLETPROOF home view that always works
def home_view(request):
    try:
        # Add current directory to Python path
        import sys
        import os
        if '/app' not in sys.path:
            sys.path.insert(0, '/app')
        
        # Try to import and use the actual view
        from Class_Based_Viewsapp.views import Allcompanies
        from Class_Based_Viewsapp.models import Comapny
        
        # Create a simple list view response
        companies = Comapny.objects.all()
        company_list = "<h1>Companies</h1><ul>"
        for company in companies:
            company_list += f"<li>{company.Name} - CEO: {company.ceo}</li>"
        company_list += "</ul>"
        return HttpResponse(company_list)
    except Exception as e:
        # Fallback to simple response with debug info
        debug_info = f"""
        <h1>Django is running!</h1>
        <p>Error: {str(e)}</p>
        <p>Python path: {sys.path}</p>
        <p>Current directory: {os.getcwd()}</p>
        <p>Directory contents: {os.listdir('/app')}</p>
        """
        return HttpResponse(debug_info)

# BULLETPROOF URL patterns with error handling
def safe_include(pattern):
    try:
        return include(pattern)
    except Exception:
        return []

urlpatterns = [
    path('', home_view, name='home'),
    path('health/', health_check, name='health'),
    path('admin/', admin.site.urls),
]

# Try to add app URLs safely
try:
    urlpatterns.append(path('company/', include('Class_Based_Viewsapp.urls')))
except Exception:
    pass