import axios from "axios";
import express from "express";
import cors from "cors";
const app=express();
app.use(express.json());
app.use(cors());

app.get('/extract/:ques',async (req,res)=>{
    const question =req.params.ques;

    try {
    const result = await axios.post(
        "https://api.tavily.com/search",
        {
        api_key: process.env.TAVILY_API_KEY,
        query: question,
        search_depth: "basic",
        max_results: 5
        }
    );

    const relevantData = result.data.results
        .filter((item) => item.score >= 0.8)
        .map((item) => ({
        title: item.title,
        source: item.url,
        information: item.content,
        relevance: item.score
        }));

    res.send(relevantData);
    }
    catch(error){
        res.send('Error : ',error);
    }
});

app.listen(3001,'0.0.0.0',()=>{
    console.log('listening on port 3000');
});
