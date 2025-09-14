import chunksModel from "../models/chunkModel.js";

export const deleteAllChunksController = async (req, res) => {
    try {
        const chunks = await chunksModel.find({}).populate("materialId")

        await chunksModel.deleteMany({});
        return res.status(200).send({
            success: true,
            message: "Delete All Chunks Successfully"
        })
    } catch (error) {
        console.log("Error in delete all chunks: ", error);
        return res.status(500).send({
            success: false,
            message: "Internal server error"
        })
    }
};