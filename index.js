require('dotenv').config();
const express = require('express');
const cors = require('cors');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY)
const app = express();
const port = process.env.PORT || 5000;

// middleware
app.use(cors());
app.use(express.json());


const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.p8flg.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

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

        const userCollection = client.db("learnHiveDB").collection("users");
        const jobApplyCollection = client.db("learnHiveDB").collection("applications");
        const addClassCollection = client.db("learnHiveDB").collection("addClasses");
        const paymentCollection = client.db("learnHiveDB").collection("payments");
        const enrollmentCollection = client.db("learnHiveDB").collection("enrollments");

        // users related apis
        // app.get('/users', async (req, res) => {
        //     const result = await userCollection.find().toArray();
        //     res.send(result);
        // })
        app.get('/users', async (req, res) => {
            const search = req.query.search;
            let query = {};
            if (search) {
                query = {
                    $or: [
                        { name: { $regex: search, $options: 'i' } },
                        { email: { $regex: search, $options: 'i' } }
                    ]
                };
            }
            const result = await userCollection.find(query).toArray();
            res.send(result);
        });

        app.get('/users/admin/:email', async (req, res) => {
            const email = req.params.email;

            const query = { email: email };
            const user = await userCollection.findOne(query);

            let admin = false;
            if (user) {
                admin = user?.role === 'admin';
            }
            res.send({ admin });
        })
        app.get('/users/teacher/:email', async (req, res) => {
            const email = req.params.email;

            const query = { email: email };
            const user = await userCollection.findOne(query);

            let teacher = false;
            if (user) {
                teacher = user?.role === 'teacher';
            }
            res.send({ teacher });
        })
        app.get('/users/student/:email', async (req, res) => {
            const email = req.params.email;

            const query = { email: email };
            const user = await userCollection.findOne(query);

            let student = false;
            if (user) {
                student = user?.role === 'student';
            }
            res.send({ student });
        })

        app.post('/users', async (req, res) => {
            const user = req.body;

            const query = { email: user.email }
            const existingUser = await userCollection.findOne(query);
            if (existingUser) {
                return res.send({ message: 'user already exists', insertedId: null })
            }

            const result = await userCollection.insertOne(user);
            res.send(result);
        })

        app.patch('/users/admin/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) }
            const updatedDoc = {
                $set: {
                    role: 'admin'
                }
            }
            const result = await userCollection.updateOne(filter, updatedDoc);
            res.send(result);
        })

        app.patch('/users/role/:email', async (req, res) => {
            const email = req.params.email;
            const filter = { email: email };
            const updatedDoc = {
                $set: {
                    role: 'teacher' // Update role to 'teacher'
                }
            };
            const result = await userCollection.updateOne(filter, updatedDoc);
            res.send(result);
        });

        app.delete('/users/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await userCollection.deleteOne(query);
            res.send(result);
        })

        // job apply related apis
        app.get('/applications', async (req, res) => {
            const result = await jobApplyCollection.find().toArray();
            res.send(result);
        })

        app.post('/applications', async (req, res) => {
            const job = req.body;
            const result = await jobApplyCollection.insertOne(job);
            res.send(result);
        })

        app.patch('/applications/approve/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };
            const updatedDoc = {
                $set: {
                    status: 'accepted' // Update status to 'accepted'
                }
            };
            const result = await jobApplyCollection.updateOne(filter, updatedDoc);
            res.send(result);
        });

        app.patch('/applications/reject/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };
            const updatedDoc = {
                $set: {
                    status: 'rejected' // Update status to 'rejected'
                }
            };
            const result = await jobApplyCollection.updateOne(filter, updatedDoc);
            res.send(result);
        });

        app.patch('/applications/request-again/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };
            const updatedDoc = {
                $set: {
                    status: 'pending' // Set status back to 'pending'
                }
            };
            const result = await jobApplyCollection.updateOne(filter, updatedDoc);
            res.send(result);
        });

        // teacher related apis
        app.get('/classes', async (req, res) => {
            const result = await addClassCollection.find().toArray();
            res.send(result);
        })

        app.get('/classes/:email', async (req, res) => {
            const query = { email: req.params.email }
            const result = await addClassCollection.find(query).toArray();
            res.send(result);
        })

        app.get('/classes', async (req, res) => {
            const email = req.query.email;
            const query = email ? { email } : {};
            const result = await addClassCollection.find(query).toArray();
            res.send(result);
        });

        app.post('/classes', async (req, res) => {
            const addClass = req.body;
            const result = await addClassCollection.insertOne(addClass);
            res.send(result);
        })

        app.patch('/classes/approve/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };
            const updatedDoc = {
                $set: {
                    status: 'accepted' // Update status to 'accepted'
                }
            };
            const result = await addClassCollection.updateOne(filter, updatedDoc);
            res.send(result);
        });

        app.patch('/classes/reject/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };
            const updatedDoc = {
                $set: {
                    status: 'rejected' // Update status to 'rejected'
                }
            };
            const result = await addClassCollection.updateOne(filter, updatedDoc);
            res.send(result);
        });

        app.patch('/classes/:id', async (req, res) => {
            const item = req.body;
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) }
            const updatedDoc = {
                $set: {
                    name: item.name,
                    category: item.category,
                    price: item.price,
                    recipe: item.recipe,
                    image: item.image
                }
            }
            const result = await addClassCollection.updateOne(filter, updatedDoc);
            res.send(result);
        })

        app.delete('/classes/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await addClassCollection.deleteOne(query);
            res.send(result);
        })

        // all classes api
        app.get('/all-classes', async (req, res) => {
            try {
                const result = await addClassCollection.find({ status: 'accepted' }).toArray();
                res.send(result);
            } catch (error) {
                res.status(500).send({ message: 'Internal Server Error' });
            }
        });

        app.get('/all-classes/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await addClassCollection.findOne(query);
            res.send(result);
        })

        

        // Payment related apis
        app.post('/create-payment-intent', async (req, res) => {
            const { price } = req.body;
            const amount = parseInt(price * 100);
            console.log(amount, 'amount inside the intent')

            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: 'usd',
                payment_method_types: ['card']
            })
            res.send({
                clientSecret: paymentIntent.client_secret
            })
        })

        app.get('/payments/:email', async (req, res) => {
            const query = { email: req.params.email }
            const result = await paymentCollection.find(query).toArray();
            res.send(result);
        })

        app.post('/payments', async (req, res) => {
            const payment = req.body;
            const paymentResult = await paymentCollection.insertOne(payment);

            // carefully delete each item from the cart
            // console.log('payment inf', payment);
            // const query = {
            //     _id: {
            //         $in: payment.cartIds.map(id => new ObjectId(id))
            //     }
            // };

            // const deleteResult = await paymentCollection.deleteMany(query);
            // res.send({ paymentResult, deleteResult });
            res.send({ paymentResult });
        })

        // app.post('/update-enrollment', async (req, res) => {
        //     const enrolment = req.body;
        //     const result = await enrollmentCollection.insertOne(enrolment);
        //     res.send(result);
        // })

        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);


app.get('/', (req, res) => {
    res.send('LearnHive is open')
})

app.listen(port, () => {
    console.log(`LearnHive is open on port ${port}`);
})