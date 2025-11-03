from django.contrib import admin
from django.urls import path, include
from django.http import JsonResponse

def health_check(request):
    return JsonResponse({'status': 'healthy'})

urlpatterns = [
    path('', include('Class_Based_Viewsapp.urls')),
    path('health/', health_check, name='health'),
    path('admin/', admin.site.urls),
]