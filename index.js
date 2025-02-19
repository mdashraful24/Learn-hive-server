require('dotenv').config();
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
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
        // await client.connect();

        const userCollection = client.db("learnHiveDB").collection("users");
        const jobApplyCollection = client.db("learnHiveDB").collection("applications");
        const addClassCollection = client.db("learnHiveDB").collection("addClasses");
        const paymentCollection = client.db("learnHiveDB").collection("payments");
        const assignmentCollection = client.db("learnHiveDB").collection("assignments");
        const terReportsCollection = client.db("learnHiveDB").collection("reviews");
        const featuresCollection = client.db("learnHiveDB").collection("features");

        // jwt related api
        app.post('/jwt', async (req, res) => {
            const user = req.body;
            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1d' });
            res.send({ token });
        })

        // verify token middlewares
        const verifyToken = (req, res, next) => {
            if (!req.headers.authorization) {
                return res.status(401).send({ message: 'unauthorized access' });
            }
            const token = req.headers.authorization.split(' ')[1];
            jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
                if (err) {
                    return res.status(401).send({ message: 'unauthorized access' });
                }
                req.decoded = decoded;
                next();
            })
        }

        const verifyAdmin = async (req, res, next) => {
            const email = req.decoded.email;
            const query = { email: email };
            const user = await userCollection.findOne(query);
            const isAdmin = user?.role === 'admin';
            if (!isAdmin) {
                return res.status(403).send({ message: 'forbidden access' });
            }
            next();
        }

        // users related api's
        app.get('/users', verifyToken, verifyAdmin, async (req, res) => {
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

        app.get('/users/:email', async (req, res) => {
            const email = req.params.email;
            const query = { email: email };
            const result = await userCollection.findOne(query);
            res.send(result);
        })

        // admin
        app.get('/users/admin/:email', verifyToken, async (req, res) => {
            const email = req.params.email;
            if (email !== req.decoded.email) {
                return res.status(403).send({ message: 'forbidden access' })
            }
            const query = { email: email };
            const user = await userCollection.findOne(query);
            let admin = false;
            if (user) {
                admin = user?.role === 'admin';
            }
            res.send({ admin });
        })

        // teacher
        app.get('/users/teacher/:email', verifyToken, async (req, res) => {
            const email = req.params.email;
            const query = { email: email };
            const user = await userCollection.findOne(query);
            let teacher = false;
            if (user) {
                teacher = user?.role === 'teacher';
            }
            res.send({ teacher });
        })

        // student
        app.get('/users/student/:email', verifyToken, async (req, res) => {
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

        // admin
        app.patch('/users/admin/:id', verifyToken, verifyAdmin, async (req, res) => {
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
                    role: 'teacher'
                }
            };
            const result = await userCollection.updateOne(filter, updatedDoc);
            res.send(result);
        });

        app.delete('/users/:id', verifyToken, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await userCollection.deleteOne(query);
            res.send(result);
        })

        // count total users
        app.get('/totalUsers', async (req, res) => {
            const result = await userCollection.find().toArray();
            res.send(result);
        })

        // updated role
        app.get('/role/:email', async (req, res) => {
            const email = req.params.email;
            try {
                const query = { email: email };
                const result = await userCollection.findOne(query, { projection: { role: 1 } });
                if (result) {
                    res.send(result);
                } else {
                    res.status(404).send({ error: 'User not found' });
                }
            } catch (error) {
                console.error(error);
                res.status(500).send({ error: 'Failed to fetch user role' });
            }
        });

        // job apply related api's
        app.get('/applications', async (req, res) => {
            const result = await jobApplyCollection.find().toArray();
            res.send(result);
        })

        app.get('/applications/:userEmail', async (req, res) => {
            const userEmail = req.params.userEmail;
            const query = { userEmail: userEmail };
            const result = await jobApplyCollection.findOne(query);
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
                    status: 'accepted'
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
                    status: 'rejected'
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
                    status: 'pending'
                }
            };
            const result = await jobApplyCollection.updateOne(filter, updatedDoc);
            res.send(result);
        });

        // classes related api's
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
                    status: 'accepted'
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
                    status: 'rejected'
                }
            };
            const result = await addClassCollection.updateOne(filter, updatedDoc);
            res.send(result);
        });

        app.patch('/classes/:id', async (req, res) => {
            const item = req.body;
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };

            const updatedDoc = {
                $set: {
                    title: item.title,
                    price: parseFloat(item.price),
                    description: item.description,
                }
            };
            const result = await addClassCollection.updateOne(filter, updatedDoc);
            res.send(result);
        })

        app.delete('/classes/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await addClassCollection.deleteOne(query);
            res.send(result);
        })

        // see details
        app.get('/details/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await addClassCollection.findOne(query);
            res.send(result);
        })

        app.patch('/details/:id', async (req, res) => {
            const item = req.body;
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };
            const updatedDoc = {
                $push: {
                    assignments: item.assignment,
                },
            };
            const result = await addClassCollection.updateOne(filter, updatedDoc);
            res.send(result);
        });

        // assignment related api's
        app.get('/assignments', async (req, res) => {
            const result = await assignmentCollection.find().toArray();
            res.send(result);
        })

        app.post('/assignments', async (req, res) => {
            const { submission, courseId, userEmail, submit } = req.body;
            const submissionData = {
                courseId,
                userEmail,
                submission,
                createdAt: new Date(),
                submit
            };
            const result = await assignmentCollection.insertOne(submissionData);
            res.send(result);
        });

        // app.get('/all-classes', async (req, res) => {
        //     const page = parseInt(req.query.page) || 1;
        //     const limit = parseInt(req.query.limit) || 10;
        //     const skip = (page - 1) * limit;
        //     try {
        //         const totalClasses = await addClassCollection.countDocuments({ status: 'accepted' });
        //         const classes = await addClassCollection.find({ status: 'accepted' })
        //             .skip(skip)
        //             .limit(limit)
        //             .toArray();
        //         res.send({
        //             totalClasses,
        //             classes,
        //         });
        //     } catch {
        //         res.status(500).send({ message: 'Internal Server Error' });
        //     }
        // });
        app.get('/all-classes', async (req, res) => {
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 10;
            const skip = (page - 1) * limit;

            const filter = { status: 'accepted' };
            const sortOption = {};

            if (req.query.sort) {
                const sortOrder = req.query.sort === "desc" ? -1 : 1;
                sortOption.price = sortOrder;
            }

            try {
                const totalClasses = await addClassCollection.countDocuments(filter);
                const classes = await addClassCollection.find(filter)
                    .sort(sortOption)
                    .skip(skip)
                    .limit(limit)
                    .toArray();

                res.send({ totalClasses, classes });
            } catch {
                res.status(500).send({ message: 'Internal Server Error' });
            }
        });

        app.get('/all-classes/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await addClassCollection.findOne(query);
            res.send(result);
        })

        // payment related api's
        app.post('/create-payment-intent', async (req, res) => {
            const { price } = req.body;
            const amount = parseInt(price * 100);
            // console.log(amount, 'amount inside the intent')

            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: 'usd',
                payment_method_types: ['card']
            })
            // console.log(paymentIntent)

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
            res.send({ paymentResult });
        })

        // student related api
        app.get('/myEnroll/:email', async (req, res) => {
            try {
                const { email } = req.params;
                const enrolledClasses = await paymentCollection.find({ email }).toArray();

                enrolledClasses.forEach(course => {
                    if (!Array.isArray(course.assignment)) {
                        course.assignment = [course.assignment];
                    }
                });

                res.send(enrolledClasses);
            } catch (error) {
                console.error("Error fetching enrolled classes:", error);
                res.status(500).send("Server Error");
            }
        });

        app.get('/enroll', async (req, res) => {
            const result = await paymentCollection.find().toArray();
            res.send(result);
        })

        // features related api
        app.get('/features', async (req, res) => {
            const result = await featuresCollection.find().toArray();
            res.send(result);
        })

        // review related api's
        app.get('/reviews', async (req, res) => {
            const result = await terReportsCollection.find().toArray();
            res.send(result);
        })

        app.post('/ter-reports', async (req, res) => {
            const reportData = req.body;
            const result = await terReportsCollection.insertOne(reportData);
            res.send(result);
        });

        
        // Send a ping to confirm a successful connection
        // await client.db("admin").command({ ping: 1 });
        // console.log("Pinged your deployment. You successfully connected to MongoDB!");
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
    // console.log(`LearnHive is open on port ${port}`);
})