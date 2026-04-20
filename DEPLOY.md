# Deployment Instructions for Profit Tracker V2

## Render Setup  
1. Sign in to your Render account (or create one if you don't have an account).  
2. Click on the `New` button and select `Web Service`.  
3. Connect your GitHub repository to Render.  
4. Choose the repository `profit-tracker-v2`.  
5. Select the branch you want to deploy (usually `main`).  
6. Fill out the service details including the name and region.  
7. For the environment, choose `Node` and specify the build command as `npm install` and the start command as `npm start`.  
8. Click on `Create Web Service` to start the deployment process.

## Environment Variables  
Make sure to set the following environment variables in your Render dashboard:  
- `DATABASE_URL`: The URL for your database connection.  
- `API_KEY`: The key for accessing external APIs if necessary.  

## Database Initialization Steps  
1. Ensure your database is created and accessible via the `DATABASE_URL` you provided.  
2. Run the following commands to initialize your database:  
   ```bash  
   npm run migrations  
   npm run seed  
   ```  
3. Confirm that the database schema is set up correctly and data is seeded as expected.

## Additional Information  
- Ensure your application is set to listen on the PORT environment variable provided by Render.  
- Check logs in the Render dashboard for any issues during deployment.
