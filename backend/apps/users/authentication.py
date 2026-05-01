from rest_framework_simplejwt.authentication import JWTAuthentication

class CustomCookieAuthentication(JWTAuthentication):
    def authenticate(self, request):
        # First, try to get the token from the header (standard behavior)
        header = self.get_header(request)
        
        # If no header, look for our custom HttpOnly cookie
        if header is None:
            raw_token = request.COOKIES.get('access_token') or None
        else:
            raw_token = self.get_raw_token(header)

        if raw_token is None:
            return None

        # Validate the token and return the user
        validated_token = self.get_validated_token(raw_token)
        return self.get_user(validated_token), validated_token