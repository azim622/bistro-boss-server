require('dotenv').config() 
const express = require ('express')
const app = express()
const cors = require('cors')
const jwt = require('jsonwebtoken')
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const port = process.env.port || 5000;


// middlewere
app.use(cors( {
 origin : "http://localhost:5173"
}))
app.use(express.json())



const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.BD_USER}:${process.env.DB_PASS}@cluster0.tu2ve.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();


    const userCollection = client.db("bistro-DB").collection("users")
    const menuCollection = client.db("bistro-DB").collection("menu")
    const reviewsCollection = client.db("bistro-DB").collection("reviews")
    const cartCollection = client.db("bistro-DB").collection("carts")
    const paymentCollection = client.db("bistro-DB").collection("payments")


    // jwt related apis 
    app.post('/jwt' , async(req , res)=>{
      const user = req.body
      const token = jwt.sign(user , process.env.ACCESS_TOKEN_SECRET , {expiresIn:'2h'})
      res.send({ token });

    })

    // middleWere
    const verifyToken = (req, res, next) => {
      console.log('inside verify token', req.headers.authorization);
      if (!req.headers.authorization) {
        return res.status(401).send({ message: 'unauthorized access' });
      }
      const token = req.headers.authorization.split(' ')[1];
      jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
          return res.status(401).send({ message: 'unauthorized access' })
        }
        req.decoded = decoded;
        next();
      })
    }

    //  use verifyAdmin after verifyToken
    const verifyAdmin = async(req , res , next)=>{
      const email = req.decoded.email
      const query = {email:email}
      const user = await userCollection.findOne(query)
      const isAdmin = user?.role === 'admin'
      if(!isAdmin){
        return res.status(403).send({message : 'forbidden access'})
      }
      next()


    }


    // user related apis
    app.get('/users', verifyToken, verifyAdmin, async (req, res) => {
      const result = await userCollection.find().toArray();
      res.send(result);
    });

    app.get('/users/admin/:email', verifyToken, async (req, res) => {
      const email = req.params.email;
    
      // Check if the decoded email matches the requested email
      if (email !== req.decoded.email) {
        return res.status(403).send({ message: 'unauthorized access' });
      }
    
      const query = { email: email };
      const user = await userCollection.findOne(query);
    
      // Check if the user exists and is an admin
      const admin = user?.role === 'admin';
      res.send({ admin });
    });
     
    app.delete('/users/:id', verifyToken , verifyAdmin, async(req , res)=>{
      const id = req.params.id
      const query = {_id : new ObjectId(id)}
      const result= await userCollection.deleteOne(query)
      res.send(result)
    })

    // make admin
    app.patch('/users/admin/:id',verifyToken, verifyAdmin, async(req , res)=>{
      const id = req.params.id
      const filter = {_id : new ObjectId(id)}
      const updatedDoc ={
        $set:{
          role : 'admin'
        }
      }
      const result = await userCollection.updateOne(filter , updatedDoc)
      res.send(result)


    })


    app.post('/users', async(req , res)=>{
      const user = req.body

      // exsesting
      const query = {email : user.email}
      const existingUser = await userCollection.findOne(query);
      if(existingUser){
        return res.send({massage: 'user already exist', insertedId: null})
      }


      const result = await userCollection.insertOne(user)
      res.send(result)
    })


    app.get('/menu', async(req , res)=>{
        const result = await menuCollection.find().toArray()
        res.send(result)
    })

    app.post('/menu',verifyToken, verifyAdmin, async(req , res)=>{
      const item = req.body
      const result = await menuCollection.insertOne(item)
      res.send(result)
    })

    app.delete('/menu/:id', verifyToken , verifyAdmin, async(req , res)=>{
      const id = req.params.id
      const query = {_id : new ObjectId(id)}
      const result = await menuCollection.deleteOne(query)
      res.send(result)
    } )

    app.get('/menu/:id', async(req , res)=>{
      const id = req.params.id
      const query = {_id : new ObjectId(id)}
      const result = await menuCollection.findOne(query)
      res.send(result)
    } )
    
    app.get('/reviews', async(req , res)=>{
        const result = await reviewsCollection.find().toArray()
        res.send(result)
    })

    // cart Collection
    app.get('/carts' , async(req , res) =>{
      const email = req .query.email
      const query = {email : email}
      const result = await cartCollection.find(query).toArray()
      res.send(result)
    })


    app.post('/carts', async(req , res)=>{
      const cartItem = req.body
      const result = await cartCollection.insertOne(cartItem)
      res.send(result)
    })

    app.delete('/carts/:id', async(req , res) =>{
      const id = req.params.id
      const query = { _id: new ObjectId(id)}
      const result = await cartCollection.deleteOne(query)
      res.send(result)
    })

    // payment intent
    app.post('/create-payment-intent' , async(req , res)=>{
      const {price } = req.body
      const amount = Math.max(parseInt(price * 100), 50)
      console.log(amount , 'inside the intent')

      const paymentIntent = await stripe.paymentIntents.create({
        amount:amount,
        currency:'usd',
        payment_method_types:['card']
      })
      res.send({
        clientSecret:paymentIntent.client_secret
      })
    })

    app.post('/payments' , async(req , res)=>{
      const payment = req.body
      const paymentResult = await paymentCollection.insertOne(payment)

      // carefully delete item from the card
      console.log('payment info', payment)
      res.send(paymentResult)
    })

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);


app.get('/', (req , res)=>{
    res.send('boss is sitting')
})

app.listen(port , ()=>{
    console.log(`bistro boss is sitting port ${port} `)
})