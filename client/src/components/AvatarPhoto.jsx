import React, { useRef, useState } from "react";
import { UserRoundPlus, CloudUpload, Trash2 } from "lucide-react";

import { Button } from "./ui/button";
import { Avatar, AvatarImage } from "./ui/avatar";

const AvatarPhoto = ({ image, setImage }) => {
  const inputRef = useRef(null);
  const [preview, setPreview] = useState(null);

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setImage(image);
      const previewUrl = URL.createObjectURL(file);
      setPreview(previewUrl);
    }
  };

  const handleRemoveImage = () => {
    setImage(null);
    setPreview(null);
    if (inputRef.current) {
      inputRef.current.value = null; //clear the file input
    }
  };

  const onChooseImage = () => {
    if (inputRef.current) {
      inputRef.current.click();
    }
  };

  return (
    <div className="flex flex-col items-center justify-center mb-6">
      <input
        type="file"
        ref={inputRef}
        accept="image/*"
        onChange={handleImageChange}
        className="hidden"
      />
      {!image ? (
        <div className="w-24 h-24 flex items-center justify-center border-2 border-dashed border-gray-300 rounded-full relative">
          <UserRoundPlus className="text-4xl text-primary" />
          <Button size="iconSm" type="button" onClick={onChooseImage}>
            <CloudUpload />
          </Button>
        </div>
      ) : (
        <div className="relative w-24 h-24 flex items-center justify-center border-2 border-gray-300 rounded-full">
          <Avatar className="w-24 h-24">
            <AvatarImage src={preview} alt="avatar image" />
          </Avatar>
          <Button size="iconRemove" type="button" onClick={handleRemoveImage}>
            <Trash2 />
          </Button>
        </div>
      )}
    </div>
  );
};

export default AvatarPhoto;
