from app import app

with app.test_client() as client:
    # Get login page
    response = client.get('/login')
    print(f'Login page status: {response.status_code}')
    
    # Try to login (we'll handle CSRF in form or disable for test)
    login_data = {
        'username': 'superadmin',
        'password': 'admin123'
    }
    response = client.post('/login', data=login_data, follow_redirects=True)
    print(f'Login response status: {response.status_code}')
    
    # Check if we got redirected to dashboard
    if response.status_code == 200 and b'Dashboard' in response.data:
        print('SUCCESS: Login successful')
    else:
        print(f'Response preview: {response.data[:500]}')
