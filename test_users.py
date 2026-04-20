from app import app
import re

with app.test_client() as client:
    # Login
    response = client.get('/login')
    csrf_token = re.search(r'name="csrf_token"[^>]*value="([^"]+)"', response.data.decode()).group(1)
    client.post('/login', data={
        'csrf_token': csrf_token,
        'username': 'admin',
        'password': 'admin123'
    })
    
    # Test user management page
    response = client.get('/users')
    print(f'User management page status: {response.status_code}')
    if response.status_code == 200:
        print('SUCCESS: User management page works!')
    
    # Test profile page
    response = client.get('/profile')
    print(f'Profile page status: {response.status_code}')
    if response.status_code == 200:
        print('SUCCESS: Profile page works!')
