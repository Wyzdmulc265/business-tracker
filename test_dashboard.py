from app import app

with app.test_client() as client:
    # Login first
    resp = client.get('/login')
    data = resp.data.decode('utf-8', errors='ignore')
    token_start = data.find('name="csrf_token"')
    value_start = data.find('value="', token_start)
    value_start += len('value="')
    value_end = data.find('"', value_start)
    csrf_token = data[value_start:value_end]
    
    login_data = {
        'csrf_token': csrf_token,
        'username': 'superadmin',
        'password': 'admin123'
    }
    # Login and follow redirects
    resp = client.post('/login', data=login_data, follow_redirects=True)
    print(f'After login, status: {resp.status_code}')
    print(f'After login, URL: {resp.request.path}')
    
    # Now access dashboard
    resp = client.get('/')
    print(f'Dashboard status: {resp.status_code}')
    if resp.status_code == 200:
        if b'Dashboard' in resp.data:
            print('SUCCESS: Dashboard loaded correctly')
        else:
            print('Dashboard loaded but content unexpected')
            print(f'Preview: {resp.data[:200]}')
    else:
        print(f'Failed to load dashboard: {resp.status_code}')
