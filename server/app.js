import express from 'express';
import next from 'next';
import userRoute from "./src/routes/user.routes.js"
import  googleSIgnIn  from './src/routes/googleAuth.routes.js';
const dev = process.env.NODE_ENV !== 'production';
const nextApp = next({ dev });
const handle = nextApp.getRequestHandler();

nextApp.prepare().then(() => {
  const app = express();
  app.get('/', (req, res) => {
    res.send('Express server :)');
  });

  app.all('*', (req, res) => {
    return handle(req, res);
  });
  app.use("/api/v1/user",userRoute);
  app.use("/api/v1/user",googleSIgnIn);

  const PORT = process.env.PORT || 3000;
  
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
});