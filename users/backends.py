# users/backends.py

from django.contrib.auth.backends import BaseBackend
from django.contrib.auth import get_user_model
from django.db.models import Q

User = get_user_model()

class TokenBackend(BaseBackend):
    """
    Кастомная аутентификация через токен
    """
    def authenticate(self, request, token=None, **kwargs):
        if not token:
            print("❌ No token provided")
            return None
            
        try:
            print(f"🔐 Authenticating with token: {token}")
            
            # Ищем пользователя по токену
            user = User.objects.get(auth_token=token)
            print(f"✅ User found: {user.username}, is_paid: {user.is_paid}")
            
            # Проверяем оплату
            if user.is_paid:
                print("✅ Payment confirmed - user authenticated")
                return user
            else:
                print("❌ User not paid - authentication failed")
                return None
                
        except User.DoesNotExist:
            print("❌ User not found with this token")
            return None
        except Exception as e:
            print(f"❌ Authentication error: {e}")
            return None

    def get_user(self, user_id):
        try:
            return User.objects.get(pk=user_id)
        except User.DoesNotExist:
            return None