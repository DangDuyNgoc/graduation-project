import React, { useEffect, useRef, useState } from "react";
import { UserRoundPlus, CloudUpload, Trash2, LoaderCircle } from "lucide-react";

import { Button } from "./ui/button";
import { Avatar, AvatarImage } from "./ui/avatar";

const AvatarPhoto = ({ image, setImage, onUpload, currentAvatar }) => {
  const inputRef = useRef(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!image && currentAvatar) {
      setPreview(currentAvatar);
    }
    console.log(currentAvatar);
  }, [currentAvatar, image]);

  const handleImageChange = async (e) => {
    const file = e.target.files[0];
    if (file) {
      setImage(file);
      const previewUrl = URL.createObjectURL(file);
      setPreview(previewUrl);

      if (onUpload) {
        try {
          setLoading(true);
          await onUpload();
        } finally {
          setLoading(false);
        }
      }
    }
  };

  // const handleRemoveImage = () => {
  //   setImage(null);
  //   setPreview(null);
  //   if (inputRef.current) {
  //     inputRef.current.value = null; //clear the file input
  //   }
  // };

  const onChooseImage = () => {
    if (inputRef.current) {
      inputRef.current.click();
    }
  };

  return (
    <div className="flex flex-col items-center justify-center mb-6 border-2 border-dashed border-gray-300 rounded-full">
      <input
        type="file"
        ref={inputRef}
        accept="image/*"
        onChange={handleImageChange}
        className="hidden"
      />

      <div
        className="relative w-24 h-24 flex items-center justify-center cursor-pointer rounded-full hover:bg-gray-50 transition"
        onClick={onChooseImage}
      >
        {preview ? (
          <Avatar className="w-24 h-24">
            <AvatarImage src={preview} alt="avatar image" />
          </Avatar>
        ) : (
          <>
            <UserRoundPlus className="text-4xl text-primary" />
            <Button size="iconSm" type="button">
              <CloudUpload />
            </Button>
          </>
        )}

        {/* {preview && (
          <Button
            size="iconRemove"
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleRemoveImage();
            }}
          >
            <Trash2 />
          </Button>
        )} */}

        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-full">
            <LoaderCircle className="animate-spin text-white w-8 h-8" />
          </div>
        )}
      </div>
    </div>
  );
};

export default AvatarPhoto;
