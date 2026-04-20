from app import app

with app.test_client() as client:
    print('=== Testing Login Flow ===')
    # 1. Get login page
    resp = client.get('/login')
    assert resp.status_code == 200
    
    # 2. Extract CSRF token
    data = resp.data.decode('utf-8', errors='ignore')
    token_start = data.find('name="csrf_token"')
    value_start = data.find('value="', token_start)
    value_start += len('value="')
    value_end = data.find('"', value_start)
    csrf_token = data[value_start:value_end]
    
    # 3. Login
    login_data = {
        'csrf_token': csrf_token,
        'username': 'superadmin',
        'password': 'admin123'
    }
    resp = client.post('/login', data=login_data, follow_redirects=True)
    assert resp.status_code == 200
    assert b'Dashboard' in resp.data
    print('✓ Login successful')
    
    print('=== Testing Logout Flow ===')
    # 4. Logout
    resp = client.get('/logout', follow_redirects=True)
    assert resp.status_code == 200
    assert b'Login' in resp.data
    print('✓ Logout successful')
    
    print('=== Testing Registration Access ===')
    # 5. Try to access registration page (should work when not logged in)
    resp = client.get('/register')
    assert resp.status_code == 200
    assert b'Register' in resp.data
    print('✓ Registration page accessible')
    
    print('\\n=== All Tests Passed ===')
